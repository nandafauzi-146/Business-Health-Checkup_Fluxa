import { createClient } from '@/lib/supabase/server'
import UsersManagementClient from '@/components/admin/UsersManagement'

export const metadata = { title: 'Kelola Tim & Staf — Fluxa Owner' }

export default async function OwnerPenggunaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Owner dapat melihat dan mengelola seluruh staf (kasir, admin, owner)
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, created_at')
    .order('created_at', { ascending: false })

  return <UsersManagementClient initialUsers={users || []} roleScope="all" currentUserId={user?.id} />
}
