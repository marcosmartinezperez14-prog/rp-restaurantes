import { redirect } from 'next/navigation'
import Link from 'next/link'
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
    <div className="min-h-screen bg-[#f4f6f9]">
      <nav className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-[#0f172a]">RP Restaurantes · TPV</span>
        <Link href="/dashboard" className="text-sm text-[#64748b] hover:text-[#0f172a] transition-colors">
          Dashboard
        </Link>
      </nav>
      <TableMap initialData={zones} restaurantId={userData.restaurant_id} />
    </div>
  )
}
