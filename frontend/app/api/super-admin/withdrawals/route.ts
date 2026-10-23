import { NextResponse } from 'next/server'
import {
  getSuperAdminServiceClient,
  requireSuperAdmin,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'

const allowedStatuses = ['pending', 'approved', 'rejected', 'completed', 'cancelled'] as const
type WithdrawalStatus = (typeof allowedStatuses)[number]

const allowedCategories = [
  'withdraw',
  'operasional',
  'server_infra',
  'pajak',
  'penarikan_dividen',
  'peralatan_software',
  'marketing',
  'lainnya',
] as const

function dateFilter(value: string | null, end = false) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined
  if (end) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response

    const params = new URL(request.url).searchParams
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(params.get('pageSize') ?? '20', 10) || 20))
    const status = params.get('status')
    const category = params.get('category')
    const search = (params.get('search') ?? '').trim().slice(0, 80)
    const startDate = dateFilter(params.get('start'))
    const endDate = dateFilter(params.get('end'), true)

    if (startDate === undefined || endDate === undefined || (startDate && endDate && startDate >= endDate)) {
      return NextResponse.json({ error: 'Rentang tanggal tidak valid.' }, { status: 400 })
    }
    if (status && !allowedStatuses.includes(status as WithdrawalStatus)) {
      return NextResponse.json({ error: 'Filter status tidak valid.' }, { status: 400 })
    }

    const admin = getSuperAdminServiceClient()

    // Query withdrawals & recorded expenses
    let query = admin
      .from('platform_withdrawals')
      .select('id, amount, currency, status, reference_number, destination, category, transaction_date, notes, created_by, reviewed_by, reviewed_at, created_at, updated_at', { count: 'exact' })
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category', category)
    if (startDate) query = query.gte('transaction_date', startDate.slice(0, 10))
    if (endDate) query = query.lt('transaction_date', endDate.slice(0, 10))
    if (search) {
      query = query.or(`reference_number.ilike.%${search}%,destination.ilike.%${search}%,notes.ilike.%${search}%`)
    }

    const from = (page - 1) * pageSize
    const { data: withdrawals, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error

    // Fetch creators and reviewers
    const userIds = [
      ...new Set(
        (withdrawals ?? [])
          .flatMap((w) => [w.created_by, w.reviewed_by])
          .filter((id): id is string => Boolean(id))
      ),
    ]

    const { data: profiles } = userIds.length
      ? await admin.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] }
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

    // Aggregates for summary
    const { data: allWithdrawals, error: aggError } = await admin
      .from('platform_withdrawals')
      .select('amount, status, category')

    if (aggError) throw aggError

    const summary = {
      totalCompletedAmount: (allWithdrawals ?? [])
        .filter((w) => w.status === 'completed')
        .reduce((sum, w) => sum + w.amount, 0),
      completedCount: (allWithdrawals ?? []).filter((w) => w.status === 'completed').length,
      pendingCount: (allWithdrawals ?? []).filter((w) => w.status === 'pending').length,
      pendingAmount: (allWithdrawals ?? [])
        .filter((w) => w.status === 'pending')
        .reduce((sum, w) => sum + w.amount, 0),
      byCategory: (allWithdrawals ?? [])
        .filter((w) => w.status === 'completed')
        .reduce((acc, w) => {
          acc[w.category] = (acc[w.category] || 0) + w.amount
          return acc
        }, {} as Record<string, number>),
    }

    const enriched = (withdrawals ?? []).map((w) => ({
      ...w,
      created_by_name: profileMap.get(w.created_by) ?? 'Super Admin',
      reviewed_by_name: w.reviewed_by ? profileMap.get(w.reviewed_by) ?? 'Super Admin' : null,
    }))

    return NextResponse.json({
      withdrawals: enriched,
      summary,
      total: count ?? 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('Unable to fetch platform withdrawals:', error)
    return NextResponse.json({ error: 'Catatan pengeluaran / withdraw belum dapat dimuat.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Data pencatatan tidak valid.' }, { status: 400 })
    }

    const input = body as Record<string, unknown>
    const amount = Number(input.amount)
    const destination = typeof input.destination === 'string' ? input.destination.trim() : ''
    const category = typeof input.category === 'string' ? input.category.trim() : 'operasional'
    const transactionDate = typeof input.transaction_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.transaction_date)
      ? input.transaction_date
      : new Date().toISOString().slice(0, 10)
    const userRef = typeof input.reference_number === 'string' ? input.reference_number.trim() : ''
    const notes = typeof input.notes === 'string' ? input.notes.trim() : ''
    const status = (input.status === 'pending' ? 'pending' : 'completed') as WithdrawalStatus

    if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000_000) {
      return NextResponse.json({ error: 'Nominal harus berupa angka bulat positif (maks Rp 10 Miliar).' }, { status: 400 })
    }
    if (destination.length < 3 || destination.length > 200) {
      return NextResponse.json({ error: 'Rekening bank / e-wallet tujuan harus antara 3 - 200 karakter.' }, { status: 400 })
    }
    if (notes.length > 500) {
      return NextResponse.json({ error: 'Catatan tidak boleh melebihi 500 karakter.' }, { status: 400 })
    }

    const dateStr = transactionDate.replace(/-/g, '')
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase()
    const referenceNumber = userRef || `EXP-${dateStr}-${randSuffix}`

    const admin = getSuperAdminServiceClient()

    const { data: record, error: insertError } = await admin
      .from('platform_withdrawals')
      .insert({
        amount,
        currency: 'IDR',
        status,
        category,
        transaction_date: transactionDate,
        reference_number: referenceNumber,
        destination,
        notes,
        created_by: auth.actorId,
        reviewed_by: status === 'completed' ? auth.actorId : null,
        reviewed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .select('id, amount, currency, status, category, transaction_date, reference_number, destination, notes, created_at')
      .single()

    if (insertError) throw insertError

    // Record audit log
    await writeSuperAdminAudit(
      admin,
      auth.actorId,
      'EXTERNAL_EXPENSE_RECORDED',
      record.id,
      {},
      {
        reference_number: referenceNumber,
        category,
        amount: String(amount),
        destination,
        transaction_date: transactionDate,
        status,
      },
      'platform_withdrawals',
    )

    return NextResponse.json({ success: true, withdrawal: record }, { status: 201 })
  } catch (error) {
    console.error('Unable to create withdrawal/expense record:', error)
    return NextResponse.json({ error: 'Catatan pengeluaran / withdraw belum dapat disimpan.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Data pembaruan tidak valid.' }, { status: 400 })
    }

    const input = body as Record<string, unknown>
    const id = typeof input.id === 'string' ? input.id : ''
    const status = input.status as WithdrawalStatus
    const notes = typeof input.notes === 'string' ? input.notes.trim() : undefined

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'ID transaksi tidak valid.' }, { status: 400 })
    }
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status baru tidak valid.' }, { status: 400 })
    }

    const admin = getSuperAdminServiceClient()

    const { data: current, error: fetchError } = await admin
      .from('platform_withdrawals')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!current) {
      return NextResponse.json({ error: 'Catatan tidak ditemukan.' }, { status: 404 })
    }

    const updatePayload: Record<string, unknown> = {
      status,
      reviewed_by: auth.actorId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (notes !== undefined) updatePayload.notes = notes

    const { error: updateError } = await admin
      .from('platform_withdrawals')
      .update(updatePayload)
      .eq('id', id)

    if (updateError) throw updateError

    // Write audit log
    await writeSuperAdminAudit(
      admin,
      auth.actorId,
      'EXPENSE_STATUS_UPDATED',
      id,
      { status: current.status },
      { status, reference_number: current.reference_number },
      'platform_withdrawals',
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unable to update expense/withdrawal record:', error)
    return NextResponse.json({ error: 'Status catatan belum dapat diperbarui.' }, { status: 500 })
  }
}
