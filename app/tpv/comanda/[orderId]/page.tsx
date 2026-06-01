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
    <div className="flex flex-col h-screen bg-[#f4f6f9]">
      <nav className="bg-white border-b border-[#e2e8f0] px-6 py-3 flex items-center gap-2 flex-shrink-0">
        <Link href="/tpv" className="text-sm text-[#64748b] hover:text-[#0f172a] transition-colors">
          ← Mapa
        </Link>
        <span className="text-[#94a3b8]">›</span>
        <span className="text-sm font-semibold text-[#0f172a]">
          TPV · {orderData.table.name}
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
