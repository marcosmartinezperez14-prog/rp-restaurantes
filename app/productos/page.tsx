import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProductos, getCategorias, getMenuItems } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import ProductsClient from './ProductsClient'
import { PERMISOS_POR_ROL, ROLES_EDITORES, type RolNombre } from '@/types/equipo'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioActual } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const roles = usuarioActual?.user_roles as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  const tieneAcceso = !rol || PERMISOS_POR_ROL[rol].modulos.includes('productos')
  const canEdit = !rol || ROLES_EDITORES.includes(rol)

  if (!tieneAcceso) {
    return (
      <AppShell title="Productos">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--text-secondary)] text-center">No tienes permisos para acceder a esta sección.</p>
          <Link href="/dashboard" className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
            Volver al inicio
          </Link>
        </div>
      </AppShell>
    )
  }

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
        canEdit={canEdit}
      />
    </AppShell>
  )
}
