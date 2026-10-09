import { createClient } from '@/lib/supabase/server'
import SalesHistoryClient from '@/components/pos/SalesHistory'

export const metadata = { title: 'Riwayat Transaksi — Fluxa POS' }

export default async function SalesHistoryPage() {
  const supabase = await createClient()

  const { data: sales, error } = await supabase
    .from('sales')
    .select(`
      id,
      invoice_number,
      created_at,
      payment_method,
      total_amount,
      discount,
      final_amount,
      status,
      void_reason,
      voided_at,
      customers (name),
      profiles:cashier_id (full_name),
      sale_items (
        id,
        quantity,
        unit_price,
        subtotal,
        products (name)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching sales history:', error)
  }

  const formattedSales = (sales || []).map((s: any) => ({
    id: s.id,
    invoice_number: s.invoice_number,
    created_at: s.created_at,
    payment_method: s.payment_method,
    subtotal: s.total_amount,
    discount: s.discount,
    final_amount: s.final_amount,
    status: s.status,
    void_reason: s.void_reason,
    voided_at: s.voided_at,
    cashier_name: s.profiles?.full_name || null,
    customer_name: s.customers?.name || null,
    items: (s.sale_items || []).map((item: any) => ({
      id: item.id,
      product_name: item.products?.name || 'Produk',
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }))
  }))

  return <SalesHistoryClient initialSales={formattedSales} />
}
