/**
 * backend/services/financial-context.service.ts
 * Service untuk mengumpulkan dan mengagregasi data finansial bisnis terkini dari Supabase.
 */

import type { BusinessChatContext } from '@intelligence/index';

export interface FetchFinancialContextOptions {
  ownerName?: string;
}

export async function fetchBusinessFinancialContext(
  supabase: any,
  options?: FetchFinancialContextOptions
): Promise<BusinessChatContext> {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = Number(dateParts.find((part) => part.type === 'year')?.value);
  const month = Number(dateParts.find((part) => part.type === 'month')?.value);
  const day = Number(dateParts.find((part) => part.type === 'day')?.value);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const today = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const startTimestamp = new Date(`${startDate}T00:00:00+07:00`).toISOString();
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const nextMonthTimestamp = new Date(`${nextMonth}T00:00:00+07:00`).toISOString();

  const [salesRes, expensesRes, receivablesRes, payablesRes, productsRes] = await Promise.all([
    supabase
      .from('sales')
      .select('final_amount, sale_items(quantity, buy_price)')
      .eq('status', 'completed')
      .gte('created_at', startTimestamp)
      .lt('created_at', nextMonthTimestamp),
    supabase
      .from('expenses')
      .select('amount, description, expense_date, expense_categories(name)')
      .gte('expense_date', startDate)
      .lt('expense_date', nextMonth)
      .order('expense_date', { ascending: false })
      .limit(100),
    supabase
      .from('receivables')
      .select('total_amount, paid_amount, due_date, created_at, note')
      .neq('status', 'paid')
      .order('created_at', { ascending: false }),
    supabase
      .from('supplier_payables')
      .select('supplier_name, due_date, created_at, total_amount, paid_amount')
      .neq('status', 'paid')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('name, stock, min_stock, buy_price, sell_price')
      .eq('is_active', true),
  ]);

  const queryError = [
    salesRes.error,
    expensesRes.error,
    receivablesRes.error,
    payablesRes.error,
    productsRes.error,
  ].find(Boolean);

  if (queryError) throw queryError;

  const sales = salesRes.data || [];
  const expenses = expensesRes.data || [];
  const receivables = receivablesRes.data || [];
  const payables = payablesRes.data || [];
  const products = productsRes.data || [];

  let revenue = 0;
  let cogs = 0;
  sales.forEach((s: any) => {
    revenue += s.final_amount || 0;
    (s.sale_items || []).forEach((item: any) => {
      cogs += (item.quantity || 0) * (item.buy_price || 0);
    });
  });

  const opex = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex;
  const inventory = products.reduce(
    (sum: number, p: any) => sum + Math.max(0, p.stock || 0) * (p.buy_price || 0),
    0
  );
  const totalReceivables = receivables.reduce(
    (sum: number, r: any) => sum + (r.total_amount - r.paid_amount),
    0
  );
  const totalPayables = payables.reduce(
    (sum: number, r: any) => sum + (r.total_amount - r.paid_amount),
    0
  );

  const ctx: BusinessChatContext = {
    owner_name: options?.ownerName || 'Pemilik',
    period_start: startDate,
    period_end: today,
    revenue,
    cogs,
    gross_profit: grossProfit,
    gross_margin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0',
    opex,
    net_profit: netProfit,
    net_margin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0',
    inventory,
    receivables: totalReceivables,
    payables: totalPayables,
    receivable_list: receivables.map((r: any) => ({
      remaining_amount: r.total_amount - r.paid_amount,
      due_date: r.due_date,
    })),
    payable_list: payables.map((r: any) => ({
      supplier_name: r.supplier_name,
      remaining_amount: r.total_amount - r.paid_amount,
      due_date: r.due_date,
      created_at: r.created_at,
    })),
    expense_list: expenses.map((e: any) => ({
      description: e.description,
      category_name: (e.expense_categories as any)?.name || 'Umum',
      amount: e.amount,
      expense_date: e.expense_date,
    })),
    product_list: products,
  };

  return ctx;
}
