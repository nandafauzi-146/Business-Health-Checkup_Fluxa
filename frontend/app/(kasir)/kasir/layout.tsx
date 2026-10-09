import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export default async function KasirLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Cek shift aktif kasir — diteruskan ke Sidebar untuk kontrol tombol logout
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, initial_cash, opened_at, status')
    .eq('cashier_id', user.id)
    .eq('status', 'open')
    .limit(1)

  const activeShift = shifts?.[0] || null

  return (
    <div className="app-layout">
      <Sidebar
        role="kasir"
        userName={profile.full_name || 'Kasir'}
        activeShift={activeShift}
      />
      <div className="main-area">
        <Topbar title="" role="kasir" />
        <div className="content-area" style={{ padding: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
