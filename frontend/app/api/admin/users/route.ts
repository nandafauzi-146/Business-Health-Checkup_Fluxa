import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Supabase Service Role Key atau URL belum dikonfigurasi di server.')
  }

  return createSupabaseAdminClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// POST: Tambah akun staf (Admin hanya boleh buat kasir)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Silakan login terlebih dahulu.' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Hanya Admin atau Owner yang dapat membuat pengguna.' }, { status: 403 })
    }

    const body = await req.json()
    const { full_name, email, password, phone } = body

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Nama lengkap, email, dan password wajib diisi.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 })
    }

    // Guard: Admin HANYA boleh menambahkan akun kasir
    let targetRole = 'kasir'
    if (callerProfile.role === 'owner' && body.role && ['kasir', 'admin', 'owner'].includes(body.role)) {
      targetRole = body.role
    }

    const adminClient = getAdminClient()

    // 1. Buat user di Auth Supabase
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        role: targetRole,
        phone: phone?.trim() || null
      }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const createdUser = authData.user

    // 2. Pastikan tabel profiles terisi / terupdate
    const { data: profileData, error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: createdUser.id,
        full_name: full_name.trim(),
        role: targetRole,
        phone: phone?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (profileError) {
      console.warn('Upsert profile notice:', profileError)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: createdUser.id,
        full_name: full_name.trim(),
        role: targetRole,
        phone: phone?.trim() || null,
        email: email.trim().toLowerCase(),
        created_at: new Date().toISOString()
      }
    })
  } catch (err: any) {
    console.error('API Error create user:', err)
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server.' }, { status: 500 })
  }
}

// PUT: Edit akun staf (Admin hanya boleh edit kasir)
export async function PUT(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Silakan login.' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Hak akses ditolak.' }, { status: 403 })
    }

    const body = await req.json()
    const { id, full_name, phone, password } = body

    if (!id || !full_name) {
      return NextResponse.json({ error: 'ID dan nama lengkap wajib diisi.' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Cek role target user
    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 })
    }

    // Guard: Admin HANYA boleh edit akun kasir
    if (callerProfile.role === 'admin' && targetProfile.role !== 'kasir') {
      return NextResponse.json({ error: 'Akses ditolak: Admin hanya berwenang mengelola akun kasir.' }, { status: 403 })
    }

    // Update profile
    const updateProfileData: any = {
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      updated_at: new Date().toISOString()
    }

    let nextRole = targetProfile.role
    if (callerProfile.role === 'owner' && body.role && ['kasir', 'admin', 'owner'].includes(body.role)) {
      updateProfileData.role = body.role
      nextRole = body.role
    }

    const { error: updateProfErr } = await adminClient
      .from('profiles')
      .update(updateProfileData)
      .eq('id', id)

    if (updateProfErr) {
      return NextResponse.json({ error: updateProfErr.message }, { status: 400 })
    }

    // Update auth metadata & password
    const authUpdatePayload: any = {
      user_metadata: {
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        role: nextRole
      }
    }
    if (password && password.trim().length >= 6) {
      authUpdatePayload.password = password.trim()
    }

    await adminClient.auth.admin.updateUserById(id, authUpdatePayload)

    return NextResponse.json({
      success: true,
      user: {
        ...targetProfile,
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        role: nextRole
      }
    })
  } catch (err: any) {
    console.error('API Error update user:', err)
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server.' }, { status: 500 })
  }
}

// DELETE: Hapus akun kasir (Admin hanya boleh hapus kasir)
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Silakan login.' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Hak akses ditolak.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib disertakan.' }, { status: 400 })
    }

    if (id === user.id) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun Anda sendiri.' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Cek target profile
    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 })
    }

    // Guard: Admin HANYA boleh hapus akun kasir
    if (callerProfile.role === 'admin' && targetProfile.role !== 'kasir') {
      return NextResponse.json({ error: 'Akses ditolak: Admin hanya berwenang menghapus akun kasir.' }, { status: 403 })
    }

    // Hapus dari Auth (secara cascade juga menghapus profiles karena onDelete: cascade)
    const { error: delAuthErr } = await adminClient.auth.admin.deleteUser(id)
    if (delAuthErr) {
      // Fallback: hapus profiles jika auth user sudah terhapus
      await adminClient.from('profiles').delete().eq('id', id)
    }

    return NextResponse.json({ success: true, message: `Akun kasir ${targetProfile.full_name} berhasil dihapus.` })
  } catch (err: any) {
    console.error('API Error delete user:', err)
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
