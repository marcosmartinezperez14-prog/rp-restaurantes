import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getZonesWithTables } from '@/app/actions/tpv'
import TableMap from '@/components/tpv/TableMap'

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

  const zones = await getZonesWithTables()

  return (
    <TableMap initialData={zones} restaurantId={userData.restaurant_id} />
  )
}
