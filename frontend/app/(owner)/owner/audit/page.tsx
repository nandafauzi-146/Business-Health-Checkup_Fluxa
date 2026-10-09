import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard } from '@/components/ui/Cards'

export const metadata = { title: 'Audit Log — Fluxa' }

function formatDate(d: string) {
  return new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const DEMO_LOGS = [
  { id: '1', action: 'CREATE_SALE', table_name: 'sales', created_at: new Date().toISOString(), new_data: { invoice: 'INV-001', total: 135000 }, user_id: 'kasir-demo' },
  { id: '2', action: 'VOID_SALE', table_name: 'sales', created_at: new Date(Date.now() - 3600000).toISOString(), new_data: { reason: 'Salah item' }, user_id: 'admin-demo' },
  { id: '3', action: 'ADJUST_STOCK', table_name: 'products', created_at: new Date(Date.now() - 7200000).toISOString(), new_data: { product: 'Kopi Arabika', qty: 50 }, user_id: 'admin-demo' },
  { id: '4', action: 'CLOSE_SHIFT', table_name: 'shifts', created_at: new Date(Date.now() - 86400000).toISOString(), new_data: { difference: 50000 }, user_id: 'kasir-demo' },
]

export default async function AuditLogPage() {
  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const displayLogs = (logs && logs.length > 0) ? logs : DEMO_LOGS

  const actionColor: Record<string, string> = {
    CREATE_SALE: 'var(--ok)',
    VOID_SALE: 'var(--bad)',
    ADJUST_STOCK: 'var(--acc)',
    CLOSE_SHIFT: 'var(--mute)',
    OPEN_SHIFT: 'var(--ok)',
  }

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Rekaman semua aksi penting di sistem" />
      <SectionCard title={`${displayLogs.length} log terbaru`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aksi</th>
                <th>Tabel</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {displayLogs.map((log: any) => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, color: 'var(--mute)', whiteSpace: 'nowrap' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                      borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: 'var(--bg)', color: actionColor[log.action] || 'var(--ink)'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--mute)' }}>
                    {log.table_name}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--mute)' }}>
                    {log.new_data ? JSON.stringify(log.new_data).slice(0, 80) + '...' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
