import { createClient } from '@/lib/supabase/server'
import AuditLogClient, { AuditLogItem } from '@/components/owner/AuditLogClient'

export const metadata = { title: 'Audit Log & Integritas Sistem — Fluxa Owner' }

export default async function AuditLogPage() {
  const supabase = await createClient()

  let mappedLogs: AuditLogItem[] = []
  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        ip_address,
        created_at,
        user_id,
        profiles (
          full_name,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && logs) {
      mappedLogs = logs.map((l: any) => ({
        id: l.id,
        action: l.action,
        table_name: l.table_name,
        record_id: l.record_id,
        old_data: l.old_data,
        new_data: l.new_data,
        ip_address: l.ip_address,
        created_at: l.created_at,
        user_id: l.user_id,
        user_name: l.profiles?.full_name || null,
        user_role: l.profiles?.role || null,
      }))
    }
  } catch (err) {
    console.error('Error fetching audit logs:', err)
  }

  return <AuditLogClient initialLogs={mappedLogs} />
}
