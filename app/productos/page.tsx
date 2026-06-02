import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import ProductsClient from './ProductsClient'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const products = await getProductos()

  return (
    <AppShell title="Productos e Inventario">
      <ProductsClient initialProducts={products} />
    </AppShell>
  )
}
