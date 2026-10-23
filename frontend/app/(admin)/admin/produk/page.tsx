import { createClient } from '@/lib/supabase/server'
import ProductsClient from '@/components/admin/Products'

export const metadata = { title: 'Kelola Produk — Fluxa' }

export default async function ProdukPage() {
  const supabase = await createClient()

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*, categories(name)')
    .order('name')

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  const loadError = productsError || categoriesError
    ? 'Data produk belum dapat dimuat. Silakan coba lagi.'
    : null

  return <ProductsClient products={products || []} categories={categories || []} loadError={loadError} />
}
