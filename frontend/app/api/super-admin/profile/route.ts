import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getSuperAdminServiceClient,
  requireSuperAdmin,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'

export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Silakan login kembali.' }, { status: 401 })
    const { data: profile, error } = await supabase.from('profiles')
      .select('full_name, phone, created_at')
      .eq('id', user.id)
      .single()
    if (error) throw error
    return NextResponse.json({
      profile: { ...profile, email: user.email ?? '' },
    })
  } catch (error) {
    console.error('Unable to load Super Admin profile.', error)
    return NextResponse.json({ error: 'Profil belum dapat dimuat.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data profil tidak valid.' }, { status: 400 })
    const input = body as Record<string, unknown>
    const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
    const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const currentPassword = input.currentPassword
    const newPassword = typeof input.newPassword === 'string' ? input.newPassword : undefined
    if (fullName.length < 2 || fullName.length > 120 || phone.length > 32
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || (newPassword !== undefined && (newPassword.length < 12 || newPassword.length > 72))) {
      return NextResponse.json({ error: 'Nama, email, telepon, atau kata sandi tidak valid.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user || !user.email) return NextResponse.json({ error: 'Silakan login kembali.' }, { status: 401 })
    const emailChanged = email !== user.email.toLowerCase()
    const passwordChanged = typeof newPassword === 'string' && newPassword.length > 0
    if (emailChanged || passwordChanged) {
      if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
        return NextResponse.json({ error: 'Masukkan kata sandi saat ini untuk mengubah kredensial.' }, { status: 400 })
      }
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (reauthError) return NextResponse.json({ error: 'Autentikasi ulang gagal. Periksa kata sandi saat ini.' }, { status: 401 })
    }

    const { data: previous, error: previousError } = await supabase.from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single()
    if (previousError) throw previousError

    const { error: profileError } = await supabase.from('profiles')
      .update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (profileError) throw profileError

    if (emailChanged) {
      const { error } = await supabase.auth.updateUser({ email })
      if (error) throw error
    }
    if (passwordChanged) {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    }

    const changes: Record<string, string | null> = {}
    const oldValues: Record<string, string | null> = {}
    if (previous.full_name !== fullName) {
      oldValues.full_name = previous.full_name
      changes.full_name = fullName
    }
    if ((previous.phone ?? '') !== phone) {
      oldValues.phone = previous.phone
      changes.phone = phone || null
    }
    if (emailChanged) {
      oldValues.email = user.email
      changes.email_change_requested = email
    }
    if (passwordChanged) changes.password_changed = 'true'

    if (Object.keys(changes).length) {
      await writeSuperAdminAudit(
        getSuperAdminServiceClient(),
        auth.actorId,
        emailChanged || passwordChanged ? 'SUPER_ADMIN_CREDENTIALS_UPDATED' : 'SUPER_ADMIN_PROFILE_UPDATED',
        user.id,
        oldValues,
        changes,
      )
    }

    return NextResponse.json({
      success: true,
      emailVerificationRequired: emailChanged,
      message: emailChanged
        ? 'Perubahan profil tersimpan. Konfirmasi alamat email baru melalui tautan verifikasi yang dikirim.'
        : 'Profil berhasil diperbarui.',
    })
  } catch (error) {
    console.error('Unable to update Super Admin profile.', error)
    return NextResponse.json({ error: 'Perubahan profil belum dapat disimpan.' }, { status: 500 })
  }
}
