import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { getUserFacingError } from '@/lib/user-facing-error'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Konfigurasi Supabase server belum lengkap.')
  }

  return createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Data pendaftaran tidak valid.' }, { status: 400 })
    }

    const { full_name, email, password, phone } = body as Record<string, unknown>
    if (typeof full_name !== 'string' || full_name.trim().length < 2 || full_name.trim().length > 120) {
      return NextResponse.json({ error: 'Nama harus diisi (2–120 karakter).' }, { status: 400 })
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Masukkan alamat email yang valid.' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'Kata sandi harus terdiri dari 8–72 karakter.' }, { status: 400 })
    }
    if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 32)) {
      return NextResponse.json({ error: 'Nomor telepon tidak valid.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const adminClient = getAdminClient()
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        phone: typeof phone === 'string' ? phone.trim() || null : null,
      },
    })

    if (authError) {
      return NextResponse.json({
        error: getUserFacingError(authError, 'Pendaftaran belum dapat diproses. Periksa kembali data dan coba lagi.'),
      }, { status: 400 })
    }

    const user = authData.user
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: user.id,
      full_name: full_name.trim(),
      role: 'owner',
      phone: typeof phone === 'string' ? phone.trim() || null : null,
      email: normalizedEmail,
      approval_status: 'pending',
      approved_at: null,
      trial_started_at: null,
      trial_ends_at: null,
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(user.id)
      if (cleanupError) {
        console.error('Unable to remove account after profile creation failed.', cleanupError)
      }
      console.error('Unable to create pending registration profile.', profileError)
      return NextResponse.json({ error: 'Pendaftaran belum dapat disimpan. Silakan coba lagi.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, approvalStatus: 'pending' }, { status: 201 })
  } catch (error) {
    console.error('Registration request failed.', error)
    return NextResponse.json({ error: 'Terjadi kendala saat memproses pendaftaran.' }, { status: 500 })
  }
}
