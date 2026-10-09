import { createClient } from '@/lib/supabase/server'
import CategoriesClient from '@/components/admin/Categories'

export const metadata = { title: 'Kelola Kategori — Fluxa Admin' }

export default async function AdminKategoriPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  return <CategoriesClient initialCategories={categories || []} />
}
