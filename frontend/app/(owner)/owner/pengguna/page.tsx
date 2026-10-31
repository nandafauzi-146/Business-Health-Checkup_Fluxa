import { createClient } from "@/lib/supabase/server";
import UsersManagementClient from "@/components/admin/UsersManagement";

export const metadata = { title: 'Fluxa | Kelola Pengguna' };

export default async function OwnerPenggunaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Dapatkan business_id dari profile pemanggil
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("business_id, role")
    .eq("id", user?.id || "")
    .maybeSingle();

  const businessId = (callerProfile as any)?.business_id || null;

  // Owner dapat melihat dan mengelola seluruh staf (kasir, admin, owner) dalam bisnisnya
  let query = supabase
    .from("profiles")
    .select("id, full_name, role, phone, email, created_at, business_id")
    .eq("approval_status", "approved");

  if (businessId) {
    query = query.eq("business_id", businessId);
  } else if (user?.id) {
    query = query.eq("id", user.id);
  }

  const { data: users } = await query.order("created_at", { ascending: false });

  return (
    <UsersManagementClient
      initialUsers={users || []}
      roleScope="all"
      currentUserId={user?.id}
    />
  );
}
