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
        <Link
          href="/tpv"
          className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors flex-shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] truncate">
              {orderData.table.name}
            </span>
            <span className="font-mono text-[10.5px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-page)] border border-[var(--border)] rounded-md px-1.5 py-0.5 flex-shrink-0">
              #{String(orderData.order_number).padStart(4, '0')}
            </span>
          </div>
        </div>
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
