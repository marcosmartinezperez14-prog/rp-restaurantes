import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMovimientosGlobal, getProductos } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import MovimientosClient from './MovimientosClient'

export default async function MovimientosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [initialData, products] = await Promise.all([
    getMovimientosGlobal({ page: 1 }),
    getProductos(),
  ])

  return (
    <AppShell title="Movimientos de stock">
      <MovimientosClient initialData={initialData} products={products} />
    </AppShell>
  )
}
