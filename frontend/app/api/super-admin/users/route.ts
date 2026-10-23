import { NextResponse } from 'next/server'
import type { UserRole } from '@/lib/supabase/types'
import {
  getSuperAdminServiceClient,
  requireSuperAdmin,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'

const roles: UserRole[] = ['kasir', 'admin', 'owner', 'super_admin']
const approvalStatuses = ['pending', 'approved', 'rejected'] as const
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data pengguna tidak valid.' }, { status: 400 })
    const input = body as Record<string, unknown>
    const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
    const password = input.password
    const role = input.role

    if (fullName.length < 2 || fullName.length > 120
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || (phone && phone.length > 32)
      || typeof password !== 'string' || password.length < 12 || password.length > 72
      || !['kasir', 'admin', 'owner'].includes(String(role))) {
      return NextResponse.json({ error: 'Nama, email, role, atau kata sandi tidak valid. Kata sandi awal minimal 12 karakter.' }, { status: 400 })
    }

    const admin = getSuperAdminServiceClient()
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone || null },
    })
    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })

    const now = new Date()
    const isOwner = role === 'owner'
    const { error: profileError } = await admin.from('profiles').upsert({
      id: authData.user.id,
      full_name: fullName,
      email,
      phone: phone || null,
      role,
      approval_status: 'approved',
      approved_at: now.toISOString(),
      reviewed_by: auth.actorId,
      reviewed_at: now.toISOString(),
      trial_started_at: isOwner ? now.toISOString() : null,
      trial_ends_at: isOwner ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      updated_at: now.toISOString(),
    })
    if (profileError) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(authData.user.id)
      if (cleanupError) console.error('Unable to clean up user after profile creation failed.', cleanupError)
      throw profileError
    }

    await writeSuperAdminAudit(
      admin,
      auth.actorId,
      'SUPER_ADMIN_USER_CREATED',
      authData.user.id,
      {},
      { full_name: fullName, email, role: String(role), approval_status: 'approved' },
    )

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Unable to create Super Admin user.', error)
    return NextResponse.json({ error: 'Akun belum dapat dibuat.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response

    const params = new URL(request.url).searchParams
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(params.get('pageSize') ?? '20', 10) || 20))
    const search = (params.get('search') ?? '').trim().slice(0, 100).replace(/[^\p{L}\p{N}@._+-]/gu, '')
    const role = params.get('role')
    const approvalStatus = params.get('approvalStatus')
    if (role && !roles.includes(role as UserRole)) {
      return NextResponse.json({ error: 'Filter role tidak valid.' }, { status: 400 })
    }
    if (approvalStatus && !approvalStatuses.includes(approvalStatus as (typeof approvalStatuses)[number])) {
      return NextResponse.json({ error: 'Filter status tidak valid.' }, { status: 400 })
    }

    const adminClient = getSuperAdminServiceClient()
    let query = adminClient.from('profiles')
      .select('id, full_name, email, phone, role, approval_status, created_at, trial_started_at, trial_ends_at', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (role) query = query.eq('role', role as UserRole)
    if (approvalStatus) query = query.eq('approval_status', approvalStatus as (typeof approvalStatuses)[number])
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

    const from = (page - 1) * pageSize
    const { data, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error

    const users = await Promise.all((data ?? []).map(async (profile) => {
      const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(profile.id)
      if (authError) {
        console.error('Unable to read auth state for listed user.', authError)
        throw new Error('Status akun belum dapat diverifikasi.')
      }
      const bannedUntil = authUser?.user?.banned_until ?? null
      return { ...profile, isActive: !bannedUntil || new Date(bannedUntil).getTime() <= Date.now() }
    }))

    return NextResponse.json({ users, total: count ?? 0, page, pageSize })
  } catch (error) {
    console.error('Unable to load Super Admin user list.', error)
    return NextResponse.json({ error: 'Daftar pengguna belum dapat dimuat.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Data perubahan pengguna tidak valid.' }, { status: 400 })
    }

    const { id, role, active } = body as Record<string, unknown>
    if (typeof id !== 'string' || !idPattern.test(id)) {
      return NextResponse.json({ error: 'ID pengguna tidak valid.' }, { status: 400 })
    }
    if (role === undefined && typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Pilih perubahan role atau status akun.' }, { status: 400 })
    }
    if (role !== undefined && (!roles.includes(role as UserRole) || role === 'super_admin')) {
      return NextResponse.json({ error: 'Role yang dipilih tidak dapat diterapkan melalui modul ini.' }, { status: 400 })
    }
    if (id === auth.actorId && active === false) {
      return NextResponse.json({ error: 'Anda tidak dapat menonaktifkan akun sendiri.' }, { status: 400 })
    }

    const adminClient = getSuperAdminServiceClient()
    const { data: target, error: targetError } = await adminClient.from('profiles')
      .select('id, role, approval_status')
      .eq('id', id)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 })
    if (target.role === 'super_admin') {
      return NextResponse.json({ error: 'Akun Super Admin hanya dapat dikelola melalui prosedur operator.' }, { status: 403 })
    }
    if (active !== undefined && target.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Hanya akun yang disetujui yang dapat diaktifkan atau dinonaktifkan.' }, { status: 409 })
    }

    if (role !== undefined && role !== target.role) {
      const { error } = await adminClient.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
      await writeSuperAdminAudit(adminClient, auth.actorId, 'SUPER_ADMIN_ROLE_CHANGE', id, { role: target.role }, { role: role as string })
    }

    if (typeof active === 'boolean') {
      const { error } = await adminClient.auth.admin.updateUserById(id, {
        ban_duration: active ? 'none' : '876000h',
      })
      if (error) throw error
      await writeSuperAdminAudit(
        adminClient,
        auth.actorId,
        active ? 'SUPER_ADMIN_ACCOUNT_ACTIVATED' : 'SUPER_ADMIN_ACCOUNT_DEACTIVATED',
        id,
        { is_active: active ? 'false' : 'true' },
        { is_active: active ? 'true' : 'false' },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unable to update Super Admin user.', error)
    return NextResponse.json({ error: 'Perubahan pengguna belum dapat disimpan.' }, { status: 500 })
  }
}
