import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getBarItems } from '@/app/actions/cocina'
import CocinaClient from '@/components/cocina/CocinaClient'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'

export default async function BarraPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { restaurantId } = ctx

  const items = await getBarItems()

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
        <h1 className="text-[var(--text-primary)] font-bold text-base">🍹 Barra</h1>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        <CocinaClient
          initialItems={items}
          restaurantId={restaurantId}
          refreshFn={getBarItems}
        />
      </main>
    </div>
  )
}
