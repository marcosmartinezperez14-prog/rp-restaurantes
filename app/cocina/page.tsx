import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getKitchenItems } from '@/app/actions/cocina'
import CocinaClient from '@/components/cocina/CocinaClient'

export default async function CocinaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/login')

  const items = await getKitchenItems()

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      <header className="bg-[#1e293b] border-b border-[#334155] px-4 h-[52px] flex items-center gap-4 shrink-0">
        <Link
          href="/dashboard"
          className="text-[#64748b] hover:text-white transition-colors text-sm"
        >
          ← Dashboard
        </Link>
        <span className="text-[#334155]">|</span>
        <h1 className="text-white font-bold text-base">🍳 Cocina</h1>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        <CocinaClient
          initialItems={items}
          restaurantId={userData.restaurant_id}
        />
      </main>
    </div>
  )
}
