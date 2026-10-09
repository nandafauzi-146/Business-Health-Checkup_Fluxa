import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import ChatAI from '@/components/owner/ChatAI'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'owner') redirect('/login')

  return (
    <div className="app-layout">
      <Sidebar role="owner" userName={profile.full_name || 'Owner'} />
      <div className="main-area">
        <Topbar title="" role="owner" />
        <div className="content-area">
          {children}
        </div>
      </div>
      {/* FluxAI Chat Widget — muncul di semua halaman owner */}
      <ChatAI />
    </div>
  )
}
