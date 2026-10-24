import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SubscriptionPage from '@/features/subscription/SubscriptionPage'

export default async function OwnerSubscriptionRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/owner/langganan')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approval_status, registration_path')
    .eq('id', user.id)
    .maybeSingle()

  // Only owners (approved or pending-subscribe onboarding) may access
  if (profile?.role === 'super_admin') {
    redirect('/super-admin/paket')
  }

  if (profile?.role === 'kasir') {
    redirect('/kasir')
  }

  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  // Owner role — render subscription page
  return <SubscriptionPage />
}
