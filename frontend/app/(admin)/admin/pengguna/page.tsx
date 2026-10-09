import { createClient } from '@/lib/supabase/server'
import UsersManagementClient from '@/components/admin/UsersManagement'

export const metadata = { title: 'Kelola Akun Kasir — Fluxa Admin' }

export default async function AdminPenggunaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sesuai aturan: Admin HANYA bisa melihat dan mengelola akun kasir
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, created_at')
    .eq('role', 'kasir')
    .order('created_at', { ascending: false })

  return <UsersManagementClient initialUsers={users || []} roleScope="kasir" currentUserId={user?.id} />
}
