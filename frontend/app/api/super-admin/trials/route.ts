import { NextResponse } from 'next/server'
import {
  getSuperAdminServiceClient,
  requireSuperAdmin,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response

    const params = new URL(request.url).searchParams
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(params.get('pageSize') ?? '20', 10) || 20))
    const state = params.get('state')
    if (state && !['active', 'expiring', 'expired', 'not-started'].includes(state)) {
      return NextResponse.json({ error: 'Filter trial tidak valid.' }, { status: 400 })
    }

    const now = new Date()
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const adminClient = getSuperAdminServiceClient()
    let query = adminClient.from('profiles')
      .select('id, full_name, email, approval_status, trial_started_at, trial_ends_at', { count: 'exact' })
      .eq('role', 'owner')
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false })
    if (state === 'active') query = query.lte('trial_started_at', now.toISOString()).gt('trial_ends_at', soon.toISOString())
    if (state === 'expiring') query = query.gt('trial_ends_at', now.toISOString()).lte('trial_ends_at', soon.toISOString())
    if (state === 'expired') query = query.lte('trial_ends_at', now.toISOString())
    if (state === 'not-started') query = query.is('trial_started_at', null)

    const start = (page - 1) * pageSize
    const { data, count, error } = await query.range(start, start + pageSize - 1)
    if (error) throw error
    return NextResponse.json({ trials: data ?? [], total: count ?? 0, page, pageSize, serverNow: now.toISOString() })
  } catch (error) {
    console.error('Unable to load Super Admin trial list.', error)
    return NextResponse.json({ error: 'Daftar trial belum dapat dimuat.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Data perubahan trial tidak valid.' }, { status: 400 })
    }
    const { id, action } = body as Record<string, unknown>
    if (typeof id !== 'string' || !idPattern.test(id) || (action !== 'extend' && action !== 'end')) {
      return NextResponse.json({ error: 'ID atau tindakan trial tidak valid.' }, { status: 400 })
    }

    const adminClient = getSuperAdminServiceClient()
    const { data: profile, error: profileError } = await adminClient.from('profiles')
      .select('id, role, approval_status, trial_started_at, trial_ends_at')
      .eq('id', id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile || profile.role !== 'owner' || profile.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Trial hanya dapat diubah untuk akun Owner yang disetujui.' }, { status: 409 })
    }

    const now = new Date()
    const currentEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : now
    const nextStart = profile.trial_started_at ?? now.toISOString()
    const nextEnd = action === 'extend'
      ? new Date(Math.max(now.getTime(), currentEnd.getTime()) + 7 * 24 * 60 * 60 * 1000).toISOString()
      : now.toISOString()
    const { error } = await adminClient.from('profiles')
      .update({ trial_started_at: nextStart, trial_ends_at: nextEnd })
      .eq('id', id)
    if (error) throw error

    const auditRecorded = await writeSuperAdminAudit(
      adminClient,
      auth.actorId,
      action === 'extend' ? 'SUPER_ADMIN_TRIAL_EXTENDED' : 'SUPER_ADMIN_TRIAL_ENDED',
      id,
      { trial_started_at: profile.trial_started_at, trial_ends_at: profile.trial_ends_at },
      { trial_started_at: nextStart, trial_ends_at: nextEnd },
    )

    return NextResponse.json({ success: true, auditRecorded, trialStartedAt: nextStart, trialEndsAt: nextEnd })
  } catch (error) {
    console.error('Unable to update Super Admin trial.', error)
    return NextResponse.json({ error: 'Perubahan masa trial belum dapat disimpan.' }, { status: 500 })
  }
}
