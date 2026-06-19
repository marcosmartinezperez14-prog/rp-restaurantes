import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import { getZonesWithTables } from '@/app/actions/tpv'
import TableMap from '@/components/tpv/TableMap'
import { ROLES_EDITORES, PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function TpvPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx

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
    canEdit = !rol || ROLES_EDITORES.includes(rol)
  }

  const zones = await getZonesWithTables()

  return (
    <TableMap initialData={zones} restaurantId={restaurantId} canEdit={canEdit} />
  )
}
