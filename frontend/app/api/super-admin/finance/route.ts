import { NextResponse } from 'next/server'
import { getSuperAdminServiceClient, requireSuperAdmin } from '@/lib/supabase/super-admin'

const statuses = ['pending', 'success', 'failed', 'expired', 'cancelled', 'refunded'] as const

function parseDate(value: string | null, exclusive = false) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return undefined
  if (exclusive) parsed.setUTCDate(parsed.getUTCDate() + 1)
  return parsed.toISOString()
}

function csvCell(value: string | number | null) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const params = new URL(request.url).searchParams
    const start = parseDate(params.get('start'))
    const end = parseDate(params.get('end'), true)
    const status = params.get('status')
    const planFilter = (params.get('plan') ?? '').trim()
    const search = (params.get('search') ?? '').trim().slice(0, 100)
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get('pageSize') ?? '20', 10) || 20))

    if (start === undefined || end === undefined || (start && end && start >= end)) {
      return NextResponse.json({ error: 'Rentang tanggal tidak valid.' }, { status: 400 })
    }
    if (status && !statuses.includes(status as (typeof statuses)[number])) {
      return NextResponse.json({ error: 'Filter status tidak valid.' }, { status: 400 })
    }

    const admin = getSuperAdminServiceClient()

    // 1. Fetch all subscription payments for comprehensive reporting
    let allPaymentsQuery = admin
      .from('subscription_payments')
      .select('id, order_id, owner_id, plan_name, amount, status, gateway_transaction_id, created_at, paid_at')
      .order('created_at', { ascending: false })

    if (start) allPaymentsQuery = allPaymentsQuery.gte('created_at', start)
    if (end) allPaymentsQuery = allPaymentsQuery.lt('created_at', end)
    if (status) allPaymentsQuery = allPaymentsQuery.eq('status', status)
    if (planFilter) allPaymentsQuery = allPaymentsQuery.eq('plan_name', planFilter)

    const { data: allPaymentsData, error: paymentsError } = await allPaymentsQuery
    if (paymentsError) throw paymentsError

    const allPayments = allPaymentsData ?? []

    // 2. Fetch Owner profiles for customer/business names
    const ownerIds = [...new Set(allPayments.map((p) => p.owner_id).filter(Boolean))]
    const { data: profilesData } = ownerIds.length
      ? await admin.from('profiles').select('id, full_name, email, phone').in('id', ownerIds)
      : { data: [] }
    const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]))

    // 3. Fetch Recorded External Expenses and Withdrawals (FR-04 Reporting Only)
    let expensesQuery = admin
      .from('platform_withdrawals')
      .select('amount, status, category, transaction_date, destination, reference_number, notes')
      .eq('status', 'completed')

    if (start) expensesQuery = expensesQuery.gte('transaction_date', start.slice(0, 10))
    if (end) expensesQuery = expensesQuery.lt('transaction_date', end.slice(0, 10))

    const { data: expensesData, error: expensesError } = await expensesQuery
    if (expensesError) console.error('Expenses query failed (non-fatal):', expensesError)
    const expenses = expensesData ?? []

    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0)
    const expensesCount = expenses.length

    // 4. Calculate Financial Metrics
    const totalPaymentsCount = allPayments.length
    const successfulPayments = allPayments.filter((p) => p.status === 'success')
    const grossRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0)
    const successCount = successfulPayments.length

    const pendingPayments = allPayments.filter((p) => p.status === 'pending')
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0)
    const pendingCount = pendingPayments.length

    const failedPayments = allPayments.filter((p) => ['failed', 'expired', 'cancelled'].includes(p.status))
    const failedAmount = failedPayments.reduce((sum, p) => sum + p.amount, 0)
    const failedCount = failedPayments.length

    const refundedPayments = allPayments.filter((p) => p.status === 'refunded')
    const refundedAmount = refundedPayments.reduce((sum, p) => sum + p.amount, 0)
    const refundedCount = refundedPayments.length

    const successRate = totalPaymentsCount > 0
      ? Number(((successCount / totalPaymentsCount) * 100).toFixed(1))
      : 0

    // Net Financial Balance = Gross Subscription Revenue - Total Recorded Expenses
    const netBalance = grossRevenue - totalExpenses

    // Revenue by Plan
    const planAgg: Record<string, { plan: string; grossRevenue: number; payments: number }> = {}
    for (const p of allPayments) {
      if (!planAgg[p.plan_name]) {
        planAgg[p.plan_name] = { plan: p.plan_name, grossRevenue: 0, payments: 0 }
      }
      planAgg[p.plan_name].payments += 1
      if (p.status === 'success') {
        planAgg[p.plan_name].grossRevenue += p.amount
      }
    }
    const byPlan = Object.values(planAgg).sort((a, b) => b.grossRevenue - a.grossRevenue)

    // 5. Daily Platform Transactions Breakdown (for Charts & Reports)
    const dailyMap: Record<string, { date: string; formattedDate: string; totalTransactions: number; successfulTransactions: number; revenue: number; failedCount: number }> = {}

    // Sort ascending for timeline charts
    const timelinePayments = [...allPayments].sort((a, b) => a.created_at.localeCompare(b.created_at))
    for (const p of timelinePayments) {
      const dayKey = p.created_at.slice(0, 10)
      if (!dailyMap[dayKey]) {
        const d = new Date(dayKey)
        const formatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
        dailyMap[dayKey] = {
          date: dayKey,
          formattedDate: formatted,
          totalTransactions: 0,
          successfulTransactions: 0,
          revenue: 0,
          failedCount: 0,
        }
      }
      dailyMap[dayKey].totalTransactions += 1
      if (p.status === 'success') {
        dailyMap[dayKey].successfulTransactions += 1
        dailyMap[dayKey].revenue += p.amount
      } else if (['failed', 'expired', 'cancelled'].includes(p.status)) {
        dailyMap[dayKey].failedCount += 1
      }
    }
    const dailyAnalytics = Object.values(dailyMap)

    // 6. Monthly Revenue Trend (for the last 12 months)
    const now = new Date()
    const monthlyMap: Record<string, { month: string; formattedMonth: string; revenue: number; count: number }> = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const key = d.toISOString().slice(0, 7)
      const formatted = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      monthlyMap[key] = { month: key, formattedMonth: formatted, revenue: 0, count: 0 }
    }
    for (const p of allPayments) {
      if (p.status === 'success') {
        const monthKey = (p.paid_at || p.created_at).slice(0, 7)
        if (monthlyMap[monthKey]) {
          monthlyMap[monthKey].revenue += p.amount
          monthlyMap[monthKey].count += 1
        }
      }
    }
    const monthlyAnalytics = Object.values(monthlyMap)

    // 7. Filtered Enriched Transactions List
    let enriched = allPayments.map((p) => {
      const profile = profileMap.get(p.owner_id)
      return {
        ...p,
        customerName: profile?.full_name ?? 'Owner FLUXA',
        customerEmail: profile?.email ?? '',
        customerPhone: profile?.phone ?? '',
      }
    })

    if (search) {
      const s = search.toLowerCase()
      enriched = enriched.filter((p) =>
        p.order_id.toLowerCase().includes(s)
        || (p.gateway_transaction_id && p.gateway_transaction_id.toLowerCase().includes(s))
        || p.customerName.toLowerCase().includes(s)
        || p.customerEmail.toLowerCase().includes(s)
        || p.plan_name.toLowerCase().includes(s)
      )
    }

    // CSV Export
    if (params.get('format') === 'csv') {
      const rows = [
        ['Order ID', 'ID Gateway', 'Nama Customer / Bisnis', 'Email', 'Paket', 'Nominal (IDR)', 'Status', 'Tanggal Transaksi', 'Tanggal Pembayaran'],
        ...enriched.map((row) => [
          row.order_id,
          row.gateway_transaction_id || '-',
          row.customerName,
          row.customerEmail,
          row.plan_name,
          row.amount,
          row.status,
          row.created_at,
          row.paid_at || '-',
        ]),
      ]
      const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
      return new Response(`\uFEFF${csv}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="laporan-keuangan-subscription.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }

    // Paginate transactions
    const totalCount = enriched.length
    const offset = (page - 1) * pageSize
    const paginatedTransactions = enriched.slice(offset, offset + pageSize)

    // All distinct plan names for filter dropdown
    const availablePlans = [...new Set(allPayments.map((p) => p.plan_name))].sort()

    return NextResponse.json({
      summary: {
        totalPayments: totalPaymentsCount,
        grossRevenue,
        successCount,
        pendingAmount,
        pendingCount,
        failedAmount,
        failedCount,
        refundedAmount,
        refundedCount,
        successRate,
        totalExpenses,
        expensesCount,
        netBalance,
        byPlan,
      },
      dailyAnalytics,
      monthlyAnalytics,
      transactions: paginatedTransactions,
      availablePlans,
      total: totalCount,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('Unable to load platform subscription finance report.', error)
    return NextResponse.json({ error: 'Laporan keuangan platform belum dapat dimuat.' }, { status: 500 })
  }
}
