import { createClient } from '@/lib/supabase/server'
import ProductsClient from '@/components/admin/Products'

export const metadata = { title: 'Kelola Produk — Fluxa' }

export default async function ProdukPage() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name)')
    .order('name')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  return <ProductsClient products={products || []} categories={categories || []} />
}
