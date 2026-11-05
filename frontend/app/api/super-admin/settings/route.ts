import { NextResponse } from 'next/server'
import {
  getSuperAdminServiceClient,
  requireSuperAdmin,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'

interface SettingRow {
  id: string
  key: string
  value: unknown
  description: string | null
  updated_at: string | null
  updated_by: string | null
}

interface ExtensionHistoryRow {
  id: string
  user_id: string
  previous_duration_days: number
  new_duration_days: number
  additional_days: number
  config_version: string
  previous_trial_ends_at: string | null
  new_trial_ends_at: string | null
  created_at: string
}

export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response

    const adminClient = getSuperAdminServiceClient()

    // 1. Fetch current trial_duration_days setting
    const { data: settingData, error: settingError } = await adminClient
      .from('system_settings')
      .select('id, key, value, description, updated_at, updated_by')
      .eq('key', 'trial_duration_days')
      .maybeSingle()

    if (settingError && settingError.code !== 'PGRST116') {
      console.warn('Unable to query system_settings directly, falling back to default:', settingError)
    }

    let trialDurationDays = 7
    if (settingData && settingData.value !== undefined && settingData.value !== null) {
      const parsed = typeof settingData.value === 'number'
        ? settingData.value
        : parseInt(String(settingData.value), 10)
      if (!isNaN(parsed) && parsed > 0) {
        trialDurationDays = parsed
      }
    }

    // 2. Fetch recent trial extension history
    let recentExtensions: ExtensionHistoryRow[] = []
    try {
      const { data: historyData } = await adminClient
        .from('trial_extension_history')
        .select('id, user_id, previous_duration_days, new_duration_days, additional_days, config_version, previous_trial_ends_at, new_trial_ends_at, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (historyData) {
        recentExtensions = historyData as ExtensionHistoryRow[]
      }
    } catch {
      // History table might not exist yet if migration has not run in local env
      recentExtensions = []
    }

    // 3. Count currently active trials (eligible for future extension)
    const nowIso = new Date().toISOString()
    let activeTrialsCount = 0
    try {
      const { count } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('approval_status', 'approved')
        .gt('trial_ends_at', nowIso)
      activeTrialsCount = count ?? 0
    } catch {
      activeTrialsCount = 0
    }

    return NextResponse.json({
      success: true,
      trialDurationDays,
      updatedAt: settingData?.updated_at ?? null,
      updatedBy: settingData?.updated_by ?? null,
      activeTrialsCount,
      recentExtensions,
    })
  } catch (error) {
    console.error('Super Admin settings GET error:', error)
    return NextResponse.json({ error: 'Gagal memuat pengaturan sistem.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) {
      return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })
    }

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Format data pengaturan tidak valid.' }, { status: 400 })
    }

    const rawDuration = (body as Record<string, unknown>).trial_duration_days
      ?? (body as Record<string, unknown>).trialDurationDays
      ?? (body as Record<string, unknown>).duration_days

    const newDuration = typeof rawDuration === 'number'
      ? rawDuration
      : parseInt(String(rawDuration), 10)

    if (isNaN(newDuration) || !Number.isInteger(newDuration) || newDuration <= 0) {
      return NextResponse.json({
        error: 'Durasi trial awal harus berupa bilangan bulat lebih besar dari 0 hari.'
      }, { status: 400 })
    }

    const adminClient = getSuperAdminServiceClient()

    // Try calling atomic RPC function first
    try {
      const { data: rpcData, error: rpcError } = await adminClient.rpc(
        'update_trial_duration_settings',
        {
          p_new_duration: newDuration,
          p_actor_id: auth.actorId,
        }
      )

      if (!rpcError && rpcData) {
        const result = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData
        return NextResponse.json({
          success: true,
          trialDurationDays: newDuration,
          previousDurationDays: result.previous_duration_days ?? result.previous_duration,
          additionalDays: result.additional_days ?? 0,
          usersExtended: result.users_extended ?? 0,
          totalAdditionalDays: result.total_additional_days ?? 0,
          configVersion: result.config_version ?? null,
        })
      }
      if (rpcError) {
        console.warn('RPC update_trial_duration_settings failed or not found, falling back to client logic:', rpcError)
      }
    } catch (rpcCallErr) {
      console.warn('RPC invocation threw error, falling back to direct database logic:', rpcCallErr)
    }

    // Fallback: direct service client execution if RPC is not yet registered
    // 1. Get current setting
    const { data: currentSetting } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'trial_duration_days')
      .maybeSingle()

    let prevDuration = 7
    if (currentSetting?.value !== undefined && currentSetting?.value !== null) {
      const parsed = typeof currentSetting.value === 'number'
        ? currentSetting.value
        : parseInt(String(currentSetting.value), 10)
      if (!isNaN(parsed) && parsed > 0) prevDuration = parsed
    }

    // 2. Upsert system_settings
    await adminClient
      .from('system_settings')
      .upsert({
        key: 'trial_duration_days',
        value: newDuration,
        description: 'Durasi trial awal akun owner baru (dalam hari)',
        updated_by: auth.actorId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    const diff = newDuration - prevDuration
    let usersExtended = 0
    const configVersion = crypto.randomUUID()

    // 3. Extend active eligible trials if increased
    if (diff > 0) {
      const now = new Date()
      // Fetch active eligible owners
      const { data: activeOwners } = await adminClient
        .from('profiles')
        .select('id, trial_ends_at')
        .eq('role', 'owner')
        .eq('approval_status', 'approved')
        .gt('trial_ends_at', now.toISOString())

      if (activeOwners && activeOwners.length > 0) {
        // Filter out those with active paid subscriptions
        const { data: activeSubs } = await adminClient
          .from('subscriptions')
          .select('owner_id')
          .in('status', ['active', 'cancelled'])
          .gt('current_period_end', now.toISOString())

        const paidOwnerIds = new Set((activeSubs || []).map(s => s.owner_id))
        const eligible = activeOwners.filter(o => !paidOwnerIds.has(o.id) && o.trial_ends_at)

        for (const owner of eligible) {
          const oldEndsAt = new Date(owner.trial_ends_at!)
          const newEndsAt = new Date(oldEndsAt.getTime() + diff * 24 * 60 * 60 * 1000)

          const { error: updateErr } = await adminClient
            .from('profiles')
            .update({ trial_ends_at: newEndsAt.toISOString() })
            .eq('id', owner.id)

          if (!updateErr) {
            usersExtended++
            try {
              await adminClient.from('trial_extension_history').insert({
                user_id: owner.id,
                previous_duration_days: prevDuration,
                new_duration_days: newDuration,
                additional_days: diff,
                config_version: configVersion,
                previous_trial_ends_at: oldEndsAt.toISOString(),
                new_trial_ends_at: newEndsAt.toISOString(),
                extended_by: auth.actorId,
              })
            } catch {
              // Non-blocking if table missing
            }
          }
        }
      }
    }

    // 4. Record audit log
    await writeSuperAdminAudit(
      adminClient,
      auth.actorId,
      'SUPER_ADMIN_TRIAL_DURATION_UPDATED',
      configVersion,
      { trial_duration_days: String(prevDuration) },
      {
        trial_duration_days: String(newDuration),
        previous_duration_days: String(prevDuration),
        additional_days: String(Math.max(0, diff)),
        users_extended: String(usersExtended),
        total_additional_days: String(usersExtended * Math.max(0, diff)),
        config_version: configVersion,
      },
      'system_settings'
    )

    return NextResponse.json({
      success: true,
      trialDurationDays: newDuration,
      previousDurationDays: prevDuration,
      additionalDays: Math.max(0, diff),
      usersExtended,
      totalAdditionalDays: usersExtended * Math.max(0, diff),
      configVersion,
    })
  } catch (error) {
    console.error('Super Admin settings POST error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui pengaturan sistem.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  return POST(request)
}

