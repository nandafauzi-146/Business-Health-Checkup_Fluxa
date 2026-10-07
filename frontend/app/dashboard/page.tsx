import { redirect } from "next/navigation";
import DashboardOverview from "@/features/admin/dashboard-overview";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const metadata = {
  title: "Dashboard | Fluxa",
  description: "Ringkasan operasional bisnis Fluxa.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(`Gagal memuat profil: ${profileError.message}`);
  if (!profileData) throw new Error("Profil pengguna belum tersedia. Hubungi administrator.");

  type Profile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "full_name" | "role">;
  type Sale = Pick<
    Database["public"]["Tables"]["sales"]["Row"],
    "id" | "invoice_number" | "final_amount" | "payment_status" | "status" | "created_at"
  >;

  const profile = profileData as unknown as Profile;
  const jakartaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { data: salesData, error: salesError } = await supabase
    .from("sales")
    .select("id, invoice_number, final_amount, payment_status, status, created_at")
    .gte("created_at", `${jakartaDate}T00:00:00+07:00`)
    .order("created_at", { ascending: false });

  if (salesError) throw new Error(`Gagal memuat ringkasan penjualan: ${salesError.message}`);

  const sales = (salesData ?? []) as unknown as Sale[];
  return <DashboardOverview fullName={profile.full_name} role={profile.role} sales={sales} />;
}
