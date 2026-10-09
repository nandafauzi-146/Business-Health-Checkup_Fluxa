import { redirect } from "next/navigation";
import CashierRegister, { type CashierCustomer, type CashierProduct } from "@/features/cashier/cashier-register";
import AppShell from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const metadata = {
  title: "Kasir | Fluxa",
  description: "Proses transaksi penjualan Fluxa.",
};

export default async function CashierPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(`Gagal memuat profil kasir: ${profileError.message}`);
  if (!profileData) throw new Error("Profil pengguna belum tersedia. Hubungi administrator.");

  type Profile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "full_name" | "role">;
  type Product = Pick<
    Database["public"]["Tables"]["products"]["Row"],
    "id" | "name" | "sku" | "sell_price" | "stock" | "unit" | "category_id"
  >;
  type Customer = Pick<Database["public"]["Tables"]["customers"]["Row"], "id" | "name" | "phone">;
  type Shift = Pick<Database["public"]["Tables"]["shifts"]["Row"], "id" | "opened_at" | "initial_cash">;

  const [productsResult, customersResult, shiftResult] = await Promise.all([
    supabase.from("products")
      .select("id, name, sku, sell_price, stock, unit, category_id")
      .eq("is_active", true)
      .order("name"),
    supabase.from("customers").select("id, name, phone").order("name"),
    supabase.from("shifts")
      .select("id, opened_at, initial_cash")
      .eq("cashier_id", user.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (productsResult.error) throw new Error(`Gagal memuat katalog produk: ${productsResult.error.message}`);
  if (customersResult.error) throw new Error(`Gagal memuat daftar pelanggan: ${customersResult.error.message}`);
  if (shiftResult.error) throw new Error(`Gagal memuat shift kasir: ${shiftResult.error.message}`);

  const profile = profileData as unknown as Profile;
  const products = (productsResult.data ?? []) as unknown as Product[];
  const shift = shiftResult.data as unknown as Shift | null;
  const categoryIds = [...new Set(products.flatMap((product) => product.category_id ? [product.category_id] : []))];
  const categoryResult = categoryIds.length
    ? await supabase.from("categories").select("id, name").in("id", categoryIds)
    : { data: [], error: null };

  if (categoryResult.error) throw new Error(`Gagal memuat kategori produk: ${categoryResult.error.message}`);
  const categoryNames = new Map((categoryResult.data ?? []).map((category) => [category.id, category.name]));
  const cashierProducts: CashierProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    price: product.sell_price,
    stock: product.stock,
    unit: product.unit,
    category: product.category_id ? categoryNames.get(product.category_id) ?? "Lainnya" : "Lainnya",
  }));
  const cashierCustomers: CashierCustomer[] = (customersResult.data as unknown as Customer[]).map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
  }));

  return (
    <AppShell adminName={profile.full_name} role={profile.role} pageTitle="Kasir">
      <CashierRegister products={cashierProducts} customers={cashierCustomers} activeShift={shift} />
    </AppShell>
  );
}
