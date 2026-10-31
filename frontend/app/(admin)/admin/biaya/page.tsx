import { createClient } from '@/lib/supabase/server'
import ExpensesClient, { Expense } from '@/components/admin/Expenses'

export const metadata = { title: 'Fluxa | Biaya Operasional' }

export default async function AdminBiayaPage() {
  const supabase = await createClient()

  let expensesData: any[] = []
  let categoriesData: any[] = []

  try {
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
          created_by,
          expense_categories (name),
          profiles:created_by (id, full_name, email, role)
        `)
        .order('created_at', { ascending: false })
        .limit(150),
      supabase
        .from('expense_categories')
        .select('id, name')
        .order('name')
    ])

    if (!expensesRes.error && expensesRes.data) {
      expensesData = expensesRes.data
    } else {
      // Fallback jika foreign relation profiles berbeda konfigurasi
      const fallbackRes = await supabase
        .from('expenses')
        .select(`
          id,
          amount,
          description,
          expense_date,
          created_at,
          category_id,
          created_by,
          expense_categories (name)
        `)
        .order('created_at', { ascending: false })
        .limit(150)
      expensesData = fallbackRes.data || []
    }

    categoriesData = categoriesRes.data || []
  } catch (err) {
    console.error('Error fetching admin expenses:', err)
  }

  const formattedExpenses: Expense[] = expensesData.map((e: any) => {
    const rawDesc = typeof e.description === 'string' ? e.description : ''

    // Ekstrak nama kasir jika pernah tersimpan di cap audit
    const auditMatch = rawDesc.match(/\[Dicatat oleh:\s*([^\]\s]+(?:\s+[^\]\s]+)*?)(?:\s+pada|\s*\])/i)
    const auditName = auditMatch ? auditMatch[1].trim() : null

    // Bersihkan deskripsi murni tanpa awalan [Shift Operasional] dan akhiran [Dicatat oleh: ...]
    const cleanDesc = rawDesc
      .replace(/^\[Shift Operasional\]\s*/i, '')
      .replace(/\s*\[Dicatat oleh:[^\]]*\]/i, '')
      .trim() || 'Pengeluaran Toko'

    const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
    const profileName = profile?.full_name || profile?.email
    const profileRole = profile?.role

    const isCashier = profileRole === 'kasir' ||
      Boolean(auditName) ||
      rawDesc.includes('[Shift Operasional]')

    const creatorName = auditName || profileName || (isCashier ? 'Kasir Utama' : 'Admin')
    const creatorRole = isCashier ? 'kasir' : (profileRole || 'admin')

    return {
      id: e.id,
      amount: e.amount || 0,
      description: cleanDesc,
      expense_date: e.expense_date || (e.created_at ? e.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
      created_at: e.created_at || new Date().toISOString(),
      category_id: e.category_id || null,
      category_name: e.expense_categories?.name || 'Umum',
      shift_id: e.shift_id || (isCashier ? 'shift' : null),
      status: 'approved' as const,
      cash_impact: true,
      created_by: e.created_by,
      creator_name: creatorName,
      creator_role: creatorRole,
    }
  })

  return (
    <ExpensesClient
      initialExpenses={formattedExpenses}
      categories={categoriesData}
    />
  )
}
