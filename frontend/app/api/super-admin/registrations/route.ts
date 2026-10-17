import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

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

export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.userId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const adminClient = getAdminClient()
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, full_name, email, phone, created_at')
      .eq('approval_status', 'pending')
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error
    return NextResponse.json({ registrations: data })
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

    const { id, action } = body as Record<string, unknown>
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'ID pendaftar tidak valid.' }, { status: 400 })
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Pilih tindakan persetujuan yang valid.' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const now = new Date()
    const approvalFields = action === 'approve'
      ? {
          approval_status: 'approved' as const,
          approved_at: now.toISOString(),
          reviewed_by: auth.userId,
          reviewed_at: now.toISOString(),
          trial_started_at: now.toISOString(),
          trial_ends_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }
      : {
          approval_status: 'rejected' as const,
          approved_at: null,
          reviewed_by: auth.userId,
          reviewed_at: now.toISOString(),
          trial_started_at: null,
          trial_ends_at: null,
        }

    const { data, error } = await adminClient
      .from('profiles')
      .update(approvalFields)
      .eq('id', id)
      .eq('role', 'owner')
      .eq('approval_status', 'pending')
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan atau sudah diproses.' }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      approvalStatus: action === 'approve' ? 'approved' : 'rejected',
      trialEndsAt: action === 'approve' ? approvalFields.trial_ends_at : null,
    })
  } catch (error) {
    console.error('Unable to process registration approval.', error)
    return NextResponse.json({ error: 'Persetujuan belum dapat diproses.' }, { status: 500 })
  }
}
