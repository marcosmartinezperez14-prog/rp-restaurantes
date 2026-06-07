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
    .eq('auth_id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/login')

  const items = await getKitchenItems()

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 h-[52px] flex items-center gap-4 shrink-0">
        <Link
          href="/dashboard"
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
        >
          ← Dashboard
        </Link>
        <span className="text-[var(--border)]">|</span>
        <h1 className="text-[var(--text-primary)] font-bold text-base">🍳 Cocina</h1>
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
