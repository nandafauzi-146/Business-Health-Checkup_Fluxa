import { createClient } from '@/lib/supabase/server'
import UsersManagementClient from '@/components/admin/UsersManagement'

export const metadata = { title: 'Fluxa | Kelola Kasir' }

export default async function AdminPenggunaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Dapatkan business_id dari profile pemanggil
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('business_id, role')
    .eq('id', user?.id || '')
    .maybeSingle()

  const businessId = (callerProfile as any)?.business_id || null

  // Sesuai aturan: Admin HANYA bisa melihat dan mengelola akun kasir di bisnis yang sama
  let query = supabase
    .from('profiles')
    .select('id, full_name, role, phone, email, created_at, business_id')
    .eq('role', 'kasir')

  if (businessId) {
    query = query.eq('business_id', businessId)
  }

  const { data: users } = await query.order('created_at', { ascending: false })

  return <UsersManagementClient initialUsers={users || []} roleScope="kasir" currentUserId={user?.id} />
}
