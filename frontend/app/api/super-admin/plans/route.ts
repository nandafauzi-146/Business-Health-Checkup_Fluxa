import { NextResponse } from 'next/server'
import {
  getSuperAdminServiceClient,
  requireSuperAdmin,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'

function parsePlan(body: unknown) {
  if (!body || typeof body !== 'object') return null
  const values = body as Record<string, unknown>
  const name = typeof values.name === 'string' ? values.name.trim() : ''
  const description = typeof values.description === 'string' ? values.description.trim() : ''
  const price = values.price
  const durationDays = values.durationDays
  const maxUsers = values.maxUsers
  const features = values.features
  if (name.length < 2 || name.length > 80 || description.length > 500
    || !Number.isSafeInteger(price) || (price as number) < 0
    || !Number.isSafeInteger(durationDays) || (durationDays as number) < 1 || (durationDays as number) > 3660
    || !Number.isSafeInteger(maxUsers) || (maxUsers as number) < 1 || (maxUsers as number) > 10000
    || !Array.isArray(features) || features.length > 30
    || features.some((feature) => typeof feature !== 'string' || feature.length > 100)) return null

  return {
    name,
    description,
    price: price as number,
    duration_days: durationDays as number,
    max_users: maxUsers as number,
    features: features as string[],
  }
}

export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    const admin = getSuperAdminServiceClient()
    const { data, error } = await admin.from('subscription_plans')
      .select('id, name, description, price, duration_days, max_users, features, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ plans: data ?? [] })
  } catch (error) {
    console.error('Unable to load subscription plans.', error)
    return NextResponse.json({ error: 'Daftar paket belum dapat dimuat.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })
    const input = parsePlan(await request.json())
    if (!input) return NextResponse.json({ error: 'Data paket tidak valid.' }, { status: 400 })

    const admin = getSuperAdminServiceClient()
    const { data, error } = await admin.from('subscription_plans')
      .insert(input)
      .select('id, name, description, price, duration_days, max_users, features, is_active')
      .single()
    if (error) throw error
    const auditRecorded = await writeSuperAdminAudit(
      admin,
      auth.actorId,
      'SUPER_ADMIN_PLAN_CREATED',
      data.id,
      {},
      { name: data.name, price: String(data.price), duration_days: String(data.duration_days) },
    )
    return NextResponse.json({ plan: data, auditRecorded }, { status: 201 })
  } catch (error) {
    console.error('Unable to create subscription plan.', error)
    return NextResponse.json({ error: 'Paket belum dapat disimpan.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data paket tidak valid.' }, { status: 400 })
    const record = body as Record<string, unknown>
    if (typeof record.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id)) {
      return NextResponse.json({ error: 'ID paket tidak valid.' }, { status: 400 })
    }

    const update = record.isActive === undefined
      ? parsePlan(record)
      : typeof record.isActive === 'boolean' ? { is_active: record.isActive } : null
    if (!update) return NextResponse.json({ error: 'Perubahan paket tidak valid.' }, { status: 400 })

    const admin = getSuperAdminServiceClient()
    const { data: previous, error: readError } = await admin.from('subscription_plans')
      .select('id, name, price, duration_days, is_active')
      .eq('id', record.id)
      .maybeSingle()
    if (readError) throw readError
    if (!previous) return NextResponse.json({ error: 'Paket tidak ditemukan.' }, { status: 404 })

    const { data, error } = await admin.from('subscription_plans')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', record.id)
      .select('id, name, description, price, duration_days, max_users, features, is_active')
      .single()
    if (error) throw error

    const auditRecorded = await writeSuperAdminAudit(
      admin,
      auth.actorId,
      'SUPER_ADMIN_PLAN_UPDATED',
      data.id,
      { name: previous.name, price: String(previous.price), duration_days: String(previous.duration_days), is_active: String(previous.is_active) },
      { name: data.name, price: String(data.price), duration_days: String(data.duration_days), is_active: String(data.is_active) },
    )
    return NextResponse.json({ plan: data, auditRecorded })
  } catch (error) {
    console.error('Unable to update subscription plan.', error)
    return NextResponse.json({ error: 'Perubahan paket belum dapat disimpan.' }, { status: 500 })
  }
}
