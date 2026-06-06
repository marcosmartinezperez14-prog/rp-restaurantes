import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getOrderWithItems, getMenuData } from '@/app/actions/tpv'
import OrderView from '@/components/tpv/OrderView'

export default async function ComandaPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const [orderData, menuData] = await Promise.all([
    getOrderWithItems(orderId),
    getMenuData(),
  ])

  if (!orderData || orderData.status !== 'open') redirect('/tpv')

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-page)]">
      <nav className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 h-[52px] flex items-center gap-3 flex-shrink-0">
        <Link href="/tpv" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          ← Mapa
        </Link>
        <span className="text-[var(--text-secondary)]">›</span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {orderData.table.name}
        </span>
      </nav>
      <div className="flex-1 overflow-hidden">
        <OrderView
          order={orderData}
          categories={menuData.categories}
          products={menuData.products}
        />
      </div>
    </div>
  )
}
