import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos, getCategorias, getMenuItems } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import ProductsClient from './ProductsClient'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [products, categories, menuItems] = await Promise.all([
    getProductos(),
    getCategorias(),
    getMenuItems(),
  ])

  return (
    <AppShell title="Productos e Inventario">
      <ProductsClient
        initialProducts={products}
        initialCategories={categories}
        initialMenuItems={menuItems}
      />
    </AppShell>
  )
}
