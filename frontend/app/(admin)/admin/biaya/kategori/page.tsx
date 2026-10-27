import { createClient } from '@/lib/supabase/server'
import ExpenseCategoriesClient, { ExpenseCategory } from '@/components/admin/ExpenseCategories'
import { PageHeader } from '@/components/layout/Topbar'

export const metadata = { title: 'Kategori Biaya Operasional — Fluxa Admin' }

export default async function AdminBiayaKategoriPage() {
  const supabase = await createClient()

  let categories: ExpenseCategory[] = []

  try {
    const { data } = await supabase
      .from('expense_categories')
      .select('id, name, description, created_at')
      .order('name')
    categories = data || []
  } catch (err) {
    console.error('Error fetching expense categories:', err)
  }

  return (
    <div>
      <PageHeader
        title="Kategori Biaya Operasional"
        subtitle="Kelola kategori untuk mengelompokkan dan mengklasifikasikan jenis pengeluaran toko"
      />
      <ExpenseCategoriesClient initialCategories={categories} />
    </div>
  )
}
