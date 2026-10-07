import { redirect } from "next/navigation";
import TransactionHistory, { type Transaction } from "@/features/admin/transaxtin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const metadata = {
  title: "Riwayat Transaksi | Fluxa",
  description: "Pantau riwayat transaksi dan pembayaran Fluxa Store.",
};

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(`Gagal memuat profil: ${profileError.message}`);

  const profile = profileData as Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "full_name" | "role"
  > | null;

  if (!profile || (profile.role !== "admin" && profile.role !== "owner")) redirect("/");

  const [salesResult, cashierResult, customerResult] = await Promise.all([
    supabase.from("sales")
      .select("id, invoice_number, cashier_id, customer_id, total_amount, final_amount, payment_method, payment_status, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("customers").select("id, name"),
  ]);

  if (salesResult.error) throw new Error(`Gagal memuat transaksi: ${salesResult.error.message}`);
  if (cashierResult.error) throw new Error(`Gagal memuat nama kasir: ${cashierResult.error.message}`);
  if (customerResult.error) throw new Error(`Gagal memuat nama pelanggan: ${customerResult.error.message}`);

  type Cashier = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;
  type Customer = Pick<Database["public"]["Tables"]["customers"]["Row"], "id" | "name">;
  type Sale = Pick<
    Database["public"]["Tables"]["sales"]["Row"],
    "id" | "invoice_number" | "cashier_id" | "customer_id" | "total_amount" |
      "final_amount" | "payment_method" | "payment_status" | "status" | "created_at"
  >;
  const cashiers = (cashierResult.data ?? []) as unknown as Cashier[];
  const customers = (customerResult.data ?? []) as unknown as Customer[];
  const sales = (salesResult.data ?? []) as unknown as Sale[];
  const cashierNames = new Map(cashiers.map((cashier) => [cashier.id, cashier.full_name]));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const transactions: Transaction[] = sales.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoice_number,
    customerName: sale.customer_id ? customerNames.get(sale.customer_id) ?? "Pelanggan tidak diketahui" : "Pelanggan umum",
    cashierName: cashierNames.get(sale.cashier_id) ?? "Kasir",
    totalAmount: sale.total_amount,
    finalAmount: sale.final_amount,
    paymentMethod: sale.payment_method,
    paymentStatus: sale.payment_status,
    status: sale.status,
    createdAt: sale.created_at,
  }));

  return <TransactionHistory transactions={transactions} adminName={profile.full_name} role={profile.role} />;
}
