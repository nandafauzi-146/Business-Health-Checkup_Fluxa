import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;
  const queryStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  let registrationStatus: 'pending' | 'rejected' | null =
    queryStatus === 'pending' || queryStatus === 'rejected' ? queryStatus : null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, approval_status")
      .eq("id", user.id)
      .single();

    if (profile?.approval_status === 'pending' || profile?.approval_status === 'rejected') {
      registrationStatus = profile.approval_status;
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Unable to end unapproved registration session.', error);
    } else {
      if (profile?.role === "super_admin") redirect("/super-admin");
      if (profile?.role === "kasir") redirect("/kasir");
      if (profile?.role === "admin") redirect("/admin");
      if (profile?.role === "owner") redirect("/owner");
    }
  }

  return <LoginForm registrationStatus={registrationStatus} />;
}
