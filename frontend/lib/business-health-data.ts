import 'server-only'

import type { createClient } from '@/lib/supabase/server'
import type { FinancialHealthInput } from '@intelligence/index'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface BusinessHealthPeriod {
  periodStart: string
  periodEnd: string
}

interface OwnerBusiness {
  businessId: string
  ownerName: string
}

export async function loadOwnerBusinessHealthData(
  supabase: SupabaseServerClient,
  owner: OwnerBusiness,
  period: BusinessHealthPeriod
) {
  const endDateParts = period.periodEnd.split('-').map(Number)
  const endExclusive = new Date(Date.UTC(
    endDateParts[0],
    endDateParts[1] - 1,
    endDateParts[2] + 1
  )).toISOString().slice(0, 10)
  const startTimestamp = new Date(`${period.periodStart}T00:00:00+07:00`).toISOString()
  const endTimestamp = new Date(`${endExclusive}T00:00:00+07:00`).toISOString()

  const [
    businessRes,
    salesRes,
    expensesRes,
    receivablesRes,
    supplierPayablesRes,
    productsRes,
    shiftsRes,
    checkupsRes,
  ] = await Promise.all([
    supabase
      .from('businesses')
      .select('name')
      .eq('id', owner.businessId)
      .single(),
    supabase
      .from('sales')
      .select('id, final_amount, shift_id')
      .eq('business_id', owner.businessId)
      .eq('status', 'completed')
      .gte('created_at', startTimestamp)
      .lt('created_at', endTimestamp),
    supabase
      .from('expenses')
      .select('amount, description, expense_date, expense_categories (name)')
      .eq('business_id', owner.businessId)
      .gte('expense_date', period.periodStart)
      .lt('expense_date', endExclusive)
      .order('expense_date', { ascending: false })
      .limit(500),
    supabase
      .from('receivables')
      .select('total_amount, paid_amount, due_date, status, created_at, note')
      .eq('business_id', owner.businessId)
      .neq('status', 'paid')
      .order('created_at', { ascending: false }),
    supabase
      .from('supplier_payables')
      .select('total_amount, paid_amount, due_date, status, created_at, note, supplier_name')
      .eq('business_id', owner.businessId)
      .neq('status', 'paid')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('name, stock, min_stock, buy_price, sell_price')
      .eq('business_id', owner.businessId)
      .eq('is_active', true),
    supabase
      .from('shifts')
      .select('id, initial_cash')
      .eq('business_id', owner.businessId)
      .eq('status', 'open'),
    supabase
      .from('checkups')
      .select('*')
      .eq('business_id', owner.businessId)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const queryError = [
    businessRes.error,
    salesRes.error,
    expensesRes.error,
    receivablesRes.error,
    supplierPayablesRes.error,
    productsRes.error,
    shiftsRes.error,
    checkupsRes.error,
  ].find(Boolean)
  if (queryError) throw new Error(`Gagal memuat data diagnosis: ${queryError.message}`)
  if (!businessRes.data) throw new Error('Bisnis Owner tidak ditemukan.')

  const sales = salesRes.data ?? []
  const saleIds = sales.map(sale => sale.id)
  let saleItems: { quantity: number; buy_price: number }[] = []
  if (saleIds.length > 0) {
    const { data, error } = await supabase
      .from('sale_items')
      .select('quantity, buy_price')
      .eq('business_id', owner.businessId)
      .in('sale_id', saleIds)
    if (error) throw new Error(`Gagal memuat rincian HPP: ${error.message}`)
    saleItems = data ?? []
  }

  const expenses = expensesRes.data ?? []
  const receivables = receivablesRes.data ?? []
  const supplierPayables = supplierPayablesRes.data ?? []
  const products = productsRes.data ?? []
  const shifts = shiftsRes.data ?? []
  const openShiftIds = shifts.map(shift => shift.id)

  let cashSales: { final_amount: number }[] = []
  if (openShiftIds.length > 0) {
    const { data, error } = await supabase
      .from('sales')
      .select('final_amount')
      .eq('business_id', owner.businessId)
      .in('shift_id', openShiftIds)
      .eq('payment_method', 'cash')
      .eq('status', 'completed')
    if (error) throw new Error(`Gagal memuat saldo kas shift: ${error.message}`)
    cashSales = data ?? []
  }

  const payableDetails = supplierPayables.map(payable => ({
    customer_name: payable.supplier_name || 'Supplier',
    total_amount: payable.total_amount || 0,
    paid_amount: payable.paid_amount || 0,
    remaining_amount: (payable.total_amount || 0) - (payable.paid_amount || 0),
    due_date: payable.due_date,
    created_at: payable.created_at,
    note: payable.note,
  }))

  const input: FinancialHealthInput = {
    period_start: period.periodStart,
    period_end: period.periodEnd,
    owner_name: owner.ownerName,
    store_name: businessRes.data.name,
    revenue: sales.reduce((sum, sale) => sum + (sale.final_amount || 0), 0),
    cogs: saleItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.buy_price || 0), 0),
    operating_expenses: expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
    cash_on_hand: shifts.reduce((sum, shift) => sum + (shift.initial_cash || 0), 0) +
      cashSales.reduce((sum, sale) => sum + (sale.final_amount || 0), 0),
    inventory_value: products.reduce((sum, product) =>
      sum + (Math.max(0, product.stock || 0) * (product.buy_price || 0)), 0),
    receivables: receivables.reduce((sum, item) =>
      sum + Math.max(0, item.total_amount - item.paid_amount), 0),
    payables: payableDetails.reduce((sum, payable) => sum + payable.remaining_amount, 0),
    receivable_details: payableDetails,
    expense_details: expenses.map(expense => ({
      description: expense.description,
      category_name: (expense.expense_categories as { name?: string } | null)?.name || 'Operasional',
      amount: expense.amount,
      expense_date: expense.expense_date,
    })),
    product_details: products.map(product => ({
      name: product.name,
      stock: product.stock,
      min_stock: product.min_stock,
      buy_price: product.buy_price,
      sell_price: product.sell_price,
      is_low_stock: product.stock <= product.min_stock,
    })),
  }

  return {
    input,
    pastCheckups: checkupsRes.data ?? [],
  }
}
