import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SuperAdminShell from '@/features/super-admin/SuperAdminShell'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role, approval_status')
    .eq('id', user.id)
    .single()

  if (error || profile?.role !== 'super_admin' || profile.approval_status !== 'approved') redirect('/login')

  return <SuperAdminShell userName={profile.full_name || user.email || 'Super Admin'}>{children}</SuperAdminShell>
}
