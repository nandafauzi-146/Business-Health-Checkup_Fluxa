import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@backend/index'

export function getSuperAdminServiceClient() {
  return getSupabaseAdminClient()
}

export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      actorId: null,
      response: NextResponse.json({ error: 'Silakan login.' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'super_admin' || profile.approval_status !== 'approved') {
    return {
      actorId: null,
      response: NextResponse.json({ error: 'Akses khusus Super Admin.' }, { status: 403 }),
    }
  }

  return { actorId: user.id, response: null }
}

export async function writeSuperAdminAudit(
  serviceClient: ReturnType<typeof getSuperAdminServiceClient>,
  actorId: string,
  action: string,
  recordId: string,
  oldData: Record<string, string | null>,
  newData: Record<string, string | null>,
  tableName: string = 'profiles',
) {
  const { error } = await serviceClient.from('audit_logs').insert({
    user_id: actorId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
  })

  if (error) {
    console.error(`Unable to write Super Admin audit event ${action}.`, error)
    throw new Error(`Perubahan diterapkan, tetapi audit event ${action} gagal disimpan.`)
  }
  return true
}
