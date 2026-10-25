import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Shift — Fluxa' }

export default async function ShiftRedirectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'owner') {
      redirect('/owner/shift')
    }
    if (profile?.role === 'admin') {
      redirect('/admin/shift')
    }
  }

  // Halaman kelola shift eksklusif untuk Admin dan Owner. Kasir diarahkan langsung ke kasir POS.
  redirect('/kasir')
}
