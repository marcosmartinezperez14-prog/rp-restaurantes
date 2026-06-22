import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import { getProductos, getCategorias, getMenuItems, getMenuCategorias } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import ProductsClient from './ProductsClient'
import { PERMISOS_POR_ROL, ROLES_EDITORES, type RolNombre } from '@/types/equipo'

export default async function ProductosPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx

  let tieneAcceso = isSuperadminMode
  let canEdit = isSuperadminMode
  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    const rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null
    tieneAcceso = !rol || PERMISOS_POR_ROL[rol].modulos.includes('productos')
    canEdit = !rol || ROLES_EDITORES.includes(rol)
  }

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

  const [products, categories, menuItems, menuCategories] = await Promise.all([
    getProductos(),
    getCategorias(),
    getMenuItems(),
    getMenuCategorias(),
  ])

  return (
    <AppShell title="Productos e Inventario">
      <ProductsClient
        initialProducts={products}
        initialCategories={categories}
        initialMenuItems={menuItems}
        initialMenuCategories={menuCategories}
        canEdit={canEdit}
      />
    </AppShell>
  )
}
