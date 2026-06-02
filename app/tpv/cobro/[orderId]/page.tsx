import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getOrderWithItems } from '@/app/actions/tpv'
import PaymentForm from '@/components/tpv/PaymentForm'
import NavDrawer from '@/components/NavDrawer'

export default async function CobroPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const order = await getOrderWithItems(orderId)

  if (!order || order.status !== 'open') redirect('/tpv')

  const activeItems = order.items.filter(i => i.status !== 'cancelled')

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <nav className="bg-white border-b border-[#e2e8f0] px-4 h-[52px] flex items-center gap-3">
        <NavDrawer />
        <Link
          href={`/tpv/comanda/${orderId}`}
          className="text-sm text-[#64748b] hover:text-[#0f172a] transition-colors"
        >
          ← Comanda
        </Link>
        <span className="text-[#94a3b8]">›</span>
        <span className="text-sm font-semibold text-[#0f172a]">
          Cobro — {order.table.name}
        </span>
      </nav>
      <div className="max-w-lg mx-auto p-6">
        <PaymentForm order={{ ...order, items: activeItems }} />
      </div>
    </div>
  )
}
