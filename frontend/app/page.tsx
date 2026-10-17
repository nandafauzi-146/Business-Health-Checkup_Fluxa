import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/landingpage')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single()

  if (profile?.approval_status === 'pending') redirect('/login?status=pending')
  if (profile?.approval_status === 'rejected') redirect('/login?status=rejected')
  if (profile?.role === 'super_admin') redirect('/super-admin')
  if (profile?.role === 'kasir') redirect('/kasir')
  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.role === 'owner') redirect('/owner')

  redirect('/landingpage')
}
