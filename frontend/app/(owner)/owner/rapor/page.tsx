import { createClient } from '@/lib/supabase/server'
import BusinessHealthClient from '@/components/owner/BusinessHealth'
import { FinancialHealthInput, evaluateBusinessHealth } from '@intelligence/index'

export const metadata = {
  title: 'Business Health Checkup — Fluxa',
}

export default async function RaporPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sesi Owner tidak ditemukan.')

  const now = new Date()
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = Number(dateParts.find(part => part.type === 'year')?.value)
  const month = Number(dateParts.find(part => part.type === 'month')?.value)
  const day = Number(dateParts.find(part => part.type === 'day')?.value)
  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const startTimestamp = new Date(`${startOfMonth}T00:00:00+07:00`).toISOString()
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
  const endTimestamp = new Date(`${tomorrow}T00:00:00+07:00`).toISOString()

  // Ambil data riil lengkap dari database Supabase
  const [
    salesRes,
    expensesRes,
    receivablesRes,
    supplierPayablesRes,
    productsRes,
    shiftsRes,
    checkupsRes,
    profileRes
  ] = await Promise.all([
    supabase
      .from('sales')
      .select(`
        final_amount,
        shift_id,
        sale_items (
          quantity,
          buy_price
        )
      `)
      .eq('status', 'completed')
      .gte('created_at', startTimestamp)
      .lt('created_at', endTimestamp),
    supabase
      .from('expenses')
      .select('amount, description, expense_date, expense_categories (name)')
      .gte('expense_date', startOfMonth)
      .lt('expense_date', tomorrow)
      .order('expense_date', { ascending: false })
      .limit(500),
    supabase
      .from('receivables')
      .select('total_amount, paid_amount, due_date, status, created_at, note')
      .neq('status', 'paid')
      .order('created_at', { ascending: false }),
    supabase
      .from('supplier_payables')
      .select('total_amount, paid_amount, due_date, status, created_at, note, supplier_name')
      .neq('status', 'paid')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('name, stock, min_stock, buy_price, sell_price')
      .eq('is_active', true),
    supabase
      .from('shifts')
      .select('id, initial_cash')
      .eq('status', 'open'),
    supabase
      .from('checkups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6),
    // Ambil nama pemilik dari profil akun yang sedang login
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
  ])

  const queryError = [
    salesRes.error,
    expensesRes.error,
    receivablesRes.error,
    supplierPayablesRes.error,
    productsRes.error,
    shiftsRes.error,
    checkupsRes.error,
    profileRes.error,
  ].find(Boolean)
  if (queryError) throw new Error(`Gagal memuat data diagnosis: ${queryError.message}`)

  const sales = salesRes.data || []
  const expenses = expensesRes.data || []
  const receivables = receivablesRes.data || []
  const supplierPayables = supplierPayablesRes.data || []
  const products = productsRes.data || []
  const shifts = shiftsRes.data || []
  const checkups = checkupsRes.data || []

  // Nama owner dari profil database (untuk sapaan personal AI)
  const ownerProfile = profileRes.data
  const ownerName = ownerProfile?.full_name || 'Pemilik'

  // 1. Hitung Omzet & HPP Riil
  let revenue = 0
  let cogs = 0

  sales.forEach((s: any) => {
    revenue += s.final_amount || 0
    if (s.sale_items && Array.isArray(s.sale_items)) {
      s.sale_items.forEach((item: any) => {
        cogs += (item.quantity || 0) * (item.buy_price || 0)
      })
    }
  })

  // 2. Hitung Beban Operasional Riil
  const operating_expenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

  // 3. Rincian hutang supplier dan piutang pelanggan yang masih terbuka
  const payable_details = supplierPayables.map((p: any) => ({
    customer_name: p.supplier_name || 'Supplier',
    total_amount: p.total_amount || 0,
    paid_amount: p.paid_amount || 0,
    remaining_amount: (p.total_amount || 0) - (p.paid_amount || 0),
    due_date: p.due_date,
    created_at: p.created_at,
    note: p.note,
  }))

  const totalSupplierPayables = payable_details.reduce((sum: number, p: any) => sum + p.remaining_amount, 0)
  const totalReceivables = receivables.reduce((sum: number, item: any) => sum + Math.max(0, item.total_amount - item.paid_amount), 0)

  // 4. Rincian Beban Operasional Konkret
  const expense_details = expenses.map((e: any) => ({
    description: e.description,
    category_name: (e.expense_categories as any)?.name || 'Operasional',
    amount: e.amount,
    expense_date: e.expense_date,
  }))

  // 5. Rincian Stok Produk Konkret
  const product_details = products.map((p: any) => ({
    name: p.name,
    stock: p.stock,
    min_stock: p.min_stock,
    buy_price: p.buy_price,
    sell_price: p.sell_price,
    is_low_stock: p.stock <= p.min_stock,
  }))

  const inventory_value = products.reduce((sum: number, p: any) => {
    return sum + (Math.max(0, p.stock || 0) * (p.buy_price || 0))
  }, 0)

  // Estimate the cash currently recorded in open drawers only.
  const openShiftIds = shifts.map(shift => shift.id)
  let cash_on_hand = shifts.reduce((sum, shift) => sum + shift.initial_cash, 0)
  if (openShiftIds.length > 0) {
    const { data: cashSales, error: cashSalesError } = await supabase
      .from('sales')
      .select('shift_id, final_amount')
      .in('shift_id', openShiftIds)
      .eq('payment_method', 'cash')
      .eq('status', 'completed')
    if (cashSalesError) throw new Error(`Gagal memuat saldo kas shift: ${cashSalesError.message}`)
    cash_on_hand += (cashSales || []).reduce((sum, sale) => sum + sale.final_amount, 0)
  }

  const realInput: FinancialHealthInput = {
    period_start: startOfMonth,
    period_end: todayStr,
    owner_name: ownerName,
    store_name: 'Toko Fluxa',
    revenue,
    cogs,
    operating_expenses,
    cash_on_hand,
    inventory_value,
    receivables: totalReceivables,
    payables: totalSupplierPayables,
    receivable_details: payable_details,
    expense_details,
    product_details
  }

  // Kalkulasi awal berbasis engine scoring deterministik
  const initialDiagnosis = evaluateBusinessHealth(realInput)

  return (
    <BusinessHealthClient
      initialInput={realInput}
      initialDiagnosis={initialDiagnosis}
      pastCheckups={checkups}
    />
  )
}
