import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import AuditLogClient, { type AuditLogItem } from '@/components/owner/AuditLogClient'
import { createClient } from '@/lib/supabase/server'
import { getSuperAdminServiceClient } from '@/lib/supabase/super-admin'

function sanitizeSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeSensitiveData)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      /email|phone|password|token|secret|key/i.test(key)
        ? []
        : [[key, sanitizeSensitiveData(entry)]],
    ),
  )
}

export default async function OwnerAuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role, approval_status')
    .eq('id', user.id)
    .single()

  if (profileError) throw new Error('Profil Owner belum dapat diverifikasi.')
  if (profile?.role !== 'owner' || profile.approval_status !== 'approved') {
    redirect('/login')
  }

  const serviceClient = getSuperAdminServiceClient()
  const { data: auditRows, error: auditError } = await supabase
    .from('audit_logs')
    .select('id, user_id, action, table_name, record_id, old_data, new_data, ip_address, created_at')
    .order('created_at', { ascending: false })
    .limit(300)

  if (auditError) throw new Error('Catatan audit belum dapat dimuat.')

  const rows = auditRows ?? []
  const actorIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))]
  const { data: actors, error: actorsError } = actorIds.length
    ? await serviceClient.from('profiles').select('id, full_name, role').in('id', actorIds)
    : { data: [], error: null }

  if (actorsError) throw new Error('Identitas aktor audit belum dapat dimuat.')

  const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]))
  const logs: AuditLogItem[] = rows
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((row) => {
      const actor = row.user_id ? actorById.get(row.user_id) : null

      return {
        id: row.id,
        action: row.action,
        table_name: row.table_name,
        created_at: row.created_at,
        record_id: row.record_id,
        old_data: sanitizeSensitiveData(row.old_data),
        new_data: sanitizeSensitiveData(row.new_data),
        user_name: actor?.full_name ?? 'Pengguna dihapus',
        user_role: actor?.role === 'owner' || actor?.role === 'admin' || actor?.role === 'kasir'
          ? actor.role
          : null,
      }
    })
    .filter((row) => row.user_role !== null)

  return (
    <div className="app-layout" data-role="owner">
      <Sidebar role="owner" userName={profile.full_name || 'Owner'} />
      <div className="main-area">
        <Topbar title="" role="owner" />
        <div className="content-area">
          <AuditLogClient initialLogs={logs} />
        </div>
      </div>
    </div>
  )
}
