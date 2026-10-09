import { createClient } from '@/lib/supabase/server'
import ShiftClient, { ShiftItem } from '@/components/pos/ShiftClient'

export const metadata = { title: 'Kelola Shift & Kasir — Fluxa Admin' }

export default async function AdminShiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [shiftsRes, profilesRes] = await Promise.all([
    supabase
      .from('shifts')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(60),
    supabase
      .from('profiles')
      .select('id, full_name, role')
  ])

  const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]))

  const allShifts: ShiftItem[] = (shiftsRes.data || []).map((s: any) => ({
    id: s.id,
    cashier_id: s.cashier_id,
    cashier_name: profileMap.get(s.cashier_id) || 'Kasir',
    opened_at: s.opened_at,
    closed_at: s.closed_at,
    initial_cash: s.initial_cash || 0,
    expected_cash: s.expected_cash || 0,
    final_cash: s.final_cash || 0,
    difference: s.difference || 0,
    note: s.note,
    status: s.status,
  }))

  const allActiveShifts = allShifts.filter(s => s.status === 'open')
  const recentShifts = allShifts.filter(s => s.status === 'closed')
  const myActiveShift = allActiveShifts.find(s => s.cashier_id === user?.id) || null

  return (
    <ShiftClient
      activeShift={myActiveShift}
      allActiveShifts={allActiveShifts}
      recentShifts={recentShifts}
      userId={user?.id || ''}
      role="admin"
    />
  )
}
