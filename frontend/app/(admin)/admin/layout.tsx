import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'owner'].includes(profile.role)) redirect('/login')

  return (
    <div className="app-layout">
      <Sidebar role="admin" userName={profile.full_name || 'Admin'} />
      <div className="main-area">
        <Topbar title="" role="admin" />
        <div className="content-area">
          {children}
        </div>
      </div>
    </div>
  )
}
