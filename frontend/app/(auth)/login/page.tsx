import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Get role and redirect
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "kasir") redirect("/kasir");
    if (profile?.role === "admin") redirect("/admin");
    if (profile?.role === "owner") redirect("/owner");
  }

  return <LoginForm />;
}
