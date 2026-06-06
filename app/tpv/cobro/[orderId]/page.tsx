import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getOrderWithItems } from '@/app/actions/tpv'
import PaymentForm from '@/components/tpv/PaymentForm'

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
    <div className="min-h-screen bg-[var(--bg-page)]">
      <nav className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 h-[52px] flex items-center gap-3">
        <Link
          href={`/tpv/comanda/${orderId}`}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          ← Comanda
        </Link>
        <span className="text-[var(--text-secondary)]">›</span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Cobro — {order.table.name}
        </span>
      </nav>
      <div className="max-w-lg mx-auto p-6">
        <PaymentForm order={{ ...order, items: activeItems }} />
      </div>
    </div>
  )
}
