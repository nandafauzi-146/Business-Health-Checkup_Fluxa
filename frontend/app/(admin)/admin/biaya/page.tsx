import { createClient } from '@/lib/supabase/server'
import ExpensesClient from '@/components/admin/Expenses'

export const metadata = { title: 'Biaya Operasional — Fluxa Admin' }

export default async function AdminBiayaPage() {
  const supabase = await createClient()

  const [expensesRes, categoriesRes] = await Promise.all([
    supabase
      .from('expenses')
      .select(`
        id,
        amount,
        description,
        expense_date,
        created_at,
        category_id,
        expense_categories (name)
      `)
      .order('expense_date', { ascending: false })
      .limit(100),
    supabase
      .from('expense_categories')
      .select('id, name')
      .order('name')
  ])

  const formattedExpenses = (expensesRes.data || []).map((e: any) => ({
    id: e.id,
    amount: e.amount,
    description: e.description,
    expense_date: e.expense_date,
    created_at: e.created_at,
    category_id: e.category_id,
    category_name: e.expense_categories?.name || 'Umum'
  }))

  return (
    <ExpensesClient
      initialExpenses={formattedExpenses}
      categories={categoriesRes.data || []}
    />
  )
}
