import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getZonesWithTables } from '@/app/actions/tpv'
import TableMap from '@/components/tpv/TableMap'
import { ROLES_EDITORES, type RolNombre } from '@/types/equipo'

export default async function TpvPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/login')

  const { data: userRoleRow } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)
    .maybeSingle()

  const rol = ((userRoleRow?.roles as { name: string } | null)?.name ?? null) as RolNombre | null
  const canEdit = !rol || ROLES_EDITORES.includes(rol)

  const zones = await getZonesWithTables()

  return (
    <TableMap initialData={zones} restaurantId={userData.restaurant_id} canEdit={canEdit} />
  )
}
