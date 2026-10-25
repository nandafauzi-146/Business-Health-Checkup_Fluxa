import { NextResponse } from 'next/server'
import { getSuperAdminServiceClient, requireSuperAdmin } from '@/lib/supabase/super-admin'

function dateFilter(value: string | null, end = false) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined
  if (end) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function csvCell(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response

    const params = new URL(request.url).searchParams
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(params.get('pageSize') ?? '25', 10) || 25))
    const category = (params.get('category') ?? 'activity').trim().toLowerCase() // 'activity' | 'finance'
    const action = (params.get('action') ?? '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 100)
    const actorSearch = (params.get('actor') ?? '').trim().replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 80)
    const startDate = dateFilter(params.get('start'))
    const endDate = dateFilter(params.get('end'), true)

    if (startDate === undefined || endDate === undefined || (startDate && endDate && startDate >= endDate)) {
      return NextResponse.json({ error: 'Rentang tanggal tidak valid.' }, { status: 400 })
    }

    const adminClient = getSuperAdminServiceClient()

    // FR-05: Activity log only focuses on Owner and Super Admin (excluding cashier/admin operational sales/shifts)
    // First retrieve eligible actor IDs (or matching search if specified)
    let eligibleActorQuery = adminClient.from('profiles').select('id, full_name, role')
    if (category === 'activity') {
      eligibleActorQuery = eligibleActorQuery.in('role', ['super_admin', 'owner'])
    }
    if (actorSearch) {
      eligibleActorQuery = eligibleActorQuery.ilike('full_name', `%${actorSearch}%`)
    }
    const { data: eligibleActors, error: actorError } = await eligibleActorQuery.limit(500)
    if (actorError) throw actorError

    const eligibleActorIds = (eligibleActors ?? []).map((a) => a.id)

    // If search was specified or in activity scope and no matching actors found
    if (category === 'activity' && eligibleActorIds.length === 0) {
      if (params.get('format') === 'csv') {
        return new Response('\uFEFFWaktu,Aktor,Role,Tindakan,Objek,ID Objek,IP,Sebelum,Sesudah\r\n', {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="audit-log.csv"',
            'Cache-Control': 'no-store',
          },
        })
      }
      return NextResponse.json({ entries: [], total: 0, page, pageSize })
    }

    // Build base query
    const applyFilters = (queryBuilder: any) => {
      let q = queryBuilder
      if (category === 'activity') {
        q = q.in('user_id', eligibleActorIds)
        // Exclude cashier sales and shifts tables
        q = q.not('table_name', 'in', '("sales","shifts")')
      } else if (category === 'finance') {
        // FR-06: Financial events: payments, subscriptions, midtrans, withdrawals, ledger
        q = q.or('table_name.in.("subscription_payments","platform_withdrawals","subscriptions","platform_ledger_entries"),action.ilike.%PAYMENT%,action.ilike.%WITHDRAW%,action.ilike.%SUBSCRIPTION%,action.ilike.%MIDTRANS%')
        if (actorSearch && eligibleActorIds.length > 0) {
          q = q.in('user_id', eligibleActorIds)
        }
      }

      if (action) q = q.ilike('action', `%${action}%`)
      if (startDate) q = q.gte('created_at', startDate)
      if (endDate) q = q.lt('created_at', endDate)
      return q
    }

    if (params.get('format') === 'csv') {
      const countQuery = applyFilters(adminClient.from('audit_logs').select('id', { count: 'exact', head: true }))
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      if ((count ?? 0) > 10000) {
        return NextResponse.json({ error: 'Ekspor melebihi 10.000 catatan. Persempit filter.' }, { status: 413 })
      }

      const exportQuery = applyFilters(
        adminClient.from('audit_logs')
          .select('id, user_id, action, table_name, record_id, old_data, new_data, ip_address, created_at')
          .order('created_at', { ascending: false })
      )
      const { data, error } = await exportQuery.limit(10000)
      if (error) throw error

      const entries = data ?? []
      const ids = [...new Set(entries.map((item: any) => item.user_id).filter((id: any): id is string => Boolean(id)))]
      const { data: actors, error: actorsError } = ids.length
        ? await adminClient.from('profiles').select('id, full_name, role').in('id', ids)
        : { data: [], error: null }
      if (actorsError) throw actorsError

      const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]))
      const rows = [
        ['Waktu', 'Aktor', 'Role', 'Tindakan', 'Objek', 'ID Objek', 'IP', 'Sebelum', 'Sesudah'],
        ...entries.map((entry: any) => {
          const actor = entry.user_id ? actorById.get(entry.user_id) : null
          return [
            entry.created_at,
            actor?.full_name ?? 'Sistem/Provider',
            actor?.role ?? 'system',
            entry.action,
            entry.table_name,
            entry.record_id ?? '',
            entry.ip_address ?? '',
            JSON.stringify(entry.old_data ?? {}),
            JSON.stringify(entry.new_data ?? {}),
          ]
        }),
      ]

      return new Response(`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-${category}-log.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const query = applyFilters(
      adminClient.from('audit_logs')
        .select('id, user_id, action, table_name, record_id, old_data, new_data, ip_address, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
    )

    const from = (page - 1) * pageSize
    const { data, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error

    const entries = data ?? []
    const entryActorIds = [...new Set(entries.map((entry: any) => entry.user_id).filter((id: any): id is string => Boolean(id)))]
    const { data: actors, error: actorsError } = entryActorIds.length
      ? await adminClient.from('profiles').select('id, full_name, role').in('id', entryActorIds)
      : { data: [], error: null }
    if (actorsError) throw actorsError

    const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]))

    return NextResponse.json({
      entries: entries.map((entry: any) => ({
        ...entry,
        actorName: entry.user_id ? actorById.get(entry.user_id)?.full_name ?? 'Pengguna' : 'Sistem / Midtrans',
        actorRole: entry.user_id ? actorById.get(entry.user_id)?.role ?? null : 'system',
      })),
      total: count ?? 0,
      page,
      pageSize,
      category,
    })
  } catch (error) {
    console.error('Unable to load Super Admin audit log.', error)
    return NextResponse.json({ error: 'Audit log belum dapat dimuat.' }, { status: 500 })
  }
}
