import { NextResponse } from 'next/server'
import { getSuperAdminServiceClient, requireSuperAdmin } from '@/lib/supabase/super-admin'

export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response

    const adminClient = getSuperAdminServiceClient()
    const now = new Date()
    const today = now.toISOString()
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
    const monthQueries = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + index, 1))
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
      return { start: start.toISOString(), end: end.toISOString(), month: start.toISOString().slice(0, 7) }
    })

    const [
      totalResult,
      pendingResult,
      approvedResult,
      rejectedResult,
      activeTrialResult,
      expiringTrialResult,
      expiredTrialResult,
      totalBusinessesResult,
      activeSubsResult,
      expiredSubsResult,
      paymentsSummaryResult,
      withdrawalsSummaryResult,
      trendResults,
      paymentTrendResults,
      activityResult,
    ] = await Promise.all([
      adminClient.from('profiles').select('id', { count: 'exact', head: true }),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'approved'),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'rejected'),
      adminClient.from('profiles').select('id', { count: 'exact', head: true })
        .eq('role', 'owner').eq('approval_status', 'approved').lte('trial_started_at', today).gt('trial_ends_at', today),
      adminClient.from('profiles').select('id', { count: 'exact', head: true })
        .eq('role', 'owner').eq('approval_status', 'approved').gt('trial_ends_at', today).lte('trial_ends_at', soon),
      adminClient.from('profiles').select('id', { count: 'exact', head: true })
        .eq('role', 'owner').eq('approval_status', 'approved').lte('trial_ends_at', today),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner'),
      adminClient.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').gt('current_period_end', today),
      adminClient.from('subscriptions').select('id', { count: 'exact', head: true }).or(`status.eq.expired,and(status.eq.active,current_period_end.lte.${today})`),
      adminClient.from('subscription_payments').select('amount, status'),
      adminClient.from('platform_withdrawals').select('amount, status'),
      Promise.all(monthQueries.map(async (month) => {
        const { count, error } = await adminClient.from('profiles')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', month.start)
          .lt('created_at', month.end)
        if (error) console.error('Error fetching user growth trend:', error)
        return { month: month.month, total: count ?? 0 }
      })),
      Promise.all(monthQueries.map(async (month) => {
        const { data, error } = await adminClient.from('subscription_payments')
          .select('amount')
          .eq('status', 'success')
          .gte('paid_at', month.start)
          .lt('paid_at', month.end)
        if (error) {
          // Non-fatal if table is missing or empty
          return { month: month.month, revenue: 0 }
        }
        const total = (data ?? []).reduce((sum, item) => sum + item.amount, 0)
        return { month: month.month, revenue: total }
      })),
      adminClient.from('audit_logs')
        .select('id, user_id, action, table_name, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const payments = paymentsSummaryResult.data ?? []
    const withdrawals = withdrawalsSummaryResult.data ?? []

    const financeSummary = {
      grossRevenue: payments.filter((p) => p.status === 'success').reduce((sum, p) => sum + p.amount, 0),
      successCount: payments.filter((p) => p.status === 'success').length,
      pendingCount: payments.filter((p) => p.status === 'pending').length,
      pendingAmount: payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
      failedCount: payments.filter((p) => ['failed', 'expired', 'cancelled'].includes(p.status)).length,
      totalWithdrawn: withdrawals.filter((w) => w.status === 'completed').reduce((sum, w) => sum + w.amount, 0),
      pendingWithdrawalsCount: withdrawals.filter((w) => w.status === 'pending').length,
    }

    const activity = activityResult.data ?? []
    const actorIds = [...new Set(activity.map((item) => item.user_id).filter((id): id is string => Boolean(id)))]
    const { data: actors, error: actorsError } = actorIds.length
      ? await adminClient.from('profiles').select('id, full_name, role').in('id', actorIds)
      : { data: [], error: null }
    if (actorsError) throw actorsError
    const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]))

    // Only owner & super_admin activities as per FR-05
    const recentAdminActivity = activity.filter((item) => {
      if (!item.user_id) return true
      const actor = actorById.get(item.user_id)
      return Boolean(actor && (actor.role === 'super_admin' || actor.role === 'owner'))
    }).slice(0, 8)

    return NextResponse.json({
      stats: {
        totalUsers: totalResult.count ?? 0,
        totalBusinesses: totalBusinessesResult.count ?? 0,
        pending: pendingResult.count ?? 0,
        approved: approvedResult.count ?? 0,
        rejected: rejectedResult.count ?? 0,
        activeTrials: activeTrialResult.count ?? 0,
        expiringTrials: expiringTrialResult.count ?? 0,
        expiredTrials: expiredTrialResult.count ?? 0,
        activeSubscriptions: activeSubsResult.count ?? 0,
        expiredSubscriptions: expiredSubsResult.count ?? 0,
      },
      finance: financeSummary,
      growth: trendResults,
      revenueTrend: paymentTrendResults,
      activity: recentAdminActivity.map((item) => ({
        ...item,
        actorName: item.user_id ? actorById.get(item.user_id)?.full_name ?? 'Pengguna' : 'Sistem / Midtrans',
        actorRole: item.user_id ? actorById.get(item.user_id)?.role ?? null : 'system',
      })),
      businessManagementAvailable: true,
    })
  } catch (error) {
    console.error('Unable to load Super Admin overview.', error)
    return NextResponse.json({ error: 'Ringkasan Super Admin belum dapat dimuat.' }, { status: 500 })
  }
}
