import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getSuperAdminServiceClient,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { response: NextResponse.json({ error: 'Silakan login.' }, { status: 401 }), userId: null }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single()

  if (error || profile?.role !== 'super_admin' || profile.approval_status !== 'approved') {
    return { response: NextResponse.json({ error: 'Akses khusus Super Admin.' }, { status: 403 }), userId: null }
  }

  return { response: null, userId: user.id }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.userId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || 'all'
    const pathFilter = searchParams.get('path') || 'all'

    const adminClient = getSuperAdminServiceClient()
    let query = adminClient
      .from('profiles')
      .select('id, full_name, email, phone, created_at, registration_path, approval_status, approved_at, reviewed_at, rejection_reason, trial_started_at, trial_ends_at')
      .eq('role', 'owner')
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter !== 'all') {
      query = query.eq('approval_status', statusFilter)
    }
    if (pathFilter !== 'all') {
      query = query.eq('registration_path', pathFilter)
    }

    let { data: profiles, error } = await query

    if (error && typeof error === 'object' && 'message' in error) {
      const msg = String(error.message || '').toLowerCase()
      if (msg.includes('registration_path') || msg.includes('rejection_reason') || msg.includes('column')) {
        let fallbackQuery = adminClient
          .from('profiles')
          .select('id, full_name, email, phone, created_at, approval_status, approved_at, reviewed_at, trial_started_at, trial_ends_at')
          .eq('role', 'owner')
          .order('created_at', { ascending: false })
          .limit(200)

        if (statusFilter !== 'all') {
          fallbackQuery = fallbackQuery.eq('approval_status', statusFilter)
        }
        const fallbackRes = await fallbackQuery
        if (!fallbackRes.error && fallbackRes.data) {
          profiles = fallbackRes.data.map((p) => ({
            ...p,
            registration_path: 'trial',
            rejection_reason: null,
          }))
          error = null
        }
      }
    }

    if (error) throw error

    // Fetch latest payments for subscribe registrations
    const ownerIds = (profiles || []).map((p) => p.id)
    let paymentsMap: Record<string, { status: string; plan_name: string; amount: number; paid_at: string | null; created_at: string }> = {}

    if (ownerIds.length > 0) {
      const { data: payments } = await adminClient
        .from('subscription_payments')
        .select('owner_id, status, plan_name, amount, paid_at, created_at')
        .in('owner_id', ownerIds)
        .order('created_at', { ascending: false })

      if (payments) {
        for (const pay of payments) {
          if (!paymentsMap[pay.owner_id]) {
            paymentsMap[pay.owner_id] = pay
          }
        }
      }
    }

    const enhancedRegistrations = (profiles || []).map((p) => ({
      ...p,
      registration_path: p.registration_path || 'trial',
      latest_payment: paymentsMap[p.id] || null,
    }))

    return NextResponse.json({ registrations: enhancedRegistrations })
  } catch (error) {
    console.error('Unable to load pending registrations.', error)
    return NextResponse.json({ error: 'Daftar pendaftaran belum dapat dimuat.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.userId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Data persetujuan tidak valid.' }, { status: 400 })
    }

    const { id, action, rejection_reason } = body as Record<string, unknown>
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'ID pendaftar tidak valid.' }, { status: 400 })
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Pilih tindakan persetujuan yang valid.' }, { status: 400 })
    }

    const adminClient = getSuperAdminServiceClient()
    const now = new Date()

    // Check if the user is a direct subscriber who already paid
    const { data: existingUser } = await adminClient
      .from('profiles')
      .select('id, full_name, approval_status, registration_path')
      .eq('id', id)
      .maybeSingle()

    if (!existingUser) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan.' }, { status: 404 })
    }

    if (existingUser.approval_status === 'approved' && existingUser.registration_path === 'subscribe') {
      return NextResponse.json(
        { error: 'Pengguna berlangganan langsung sudah disetujui otomatis melalui pembayaran dan tidak memerlukan persetujuan manual.' },
        { status: 400 },
      )
    }

    const rejectionReasonText = typeof rejection_reason === 'string' && rejection_reason.trim()
      ? rejection_reason.trim()
      : null

    const approvalFields = action === 'approve'
      ? {
        approval_status: 'approved' as const,
        approved_at: now.toISOString(),
        reviewed_by: auth.userId,
        reviewed_at: now.toISOString(),
        rejection_reason: null,
        trial_started_at: now.toISOString(),
        trial_ends_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }
      : {
        approval_status: 'rejected' as const,
        approved_at: null,
        reviewed_by: auth.userId,
        reviewed_at: now.toISOString(),
        rejection_reason: rejectionReasonText,
        trial_started_at: null,
        trial_ends_at: null,
      }

    const { data, error } = await adminClient
      .from('profiles')
      .update(approvalFields)
      .eq('id', id)
      .eq('role', 'owner')
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan atau sudah diproses.' }, { status: 409 })
    }

    const auditRecorded = await writeSuperAdminAudit(
      adminClient,
      auth.userId,
      action === 'approve' ? 'SUPER_ADMIN_REGISTRATION_APPROVED' : 'SUPER_ADMIN_REGISTRATION_REJECTED',
      id,
      { approval_status: existingUser.approval_status },
      {
        approval_status: action === 'approve' ? 'approved' : 'rejected',
        trial_ends_at: action === 'approve' ? approvalFields.trial_ends_at : null,
        rejection_reason: rejectionReasonText,
      },
    )

    return NextResponse.json({
      success: true,
      auditRecorded,
      approvalStatus: action === 'approve' ? 'approved' : 'rejected',
      trialEndsAt: action === 'approve' ? approvalFields.trial_ends_at : null,
    })
  } catch (error) {
    console.error('Unable to process registration approval.', error)
    return NextResponse.json({ error: 'Persetujuan belum dapat diproses.' }, { status: 500 })
  }
}
