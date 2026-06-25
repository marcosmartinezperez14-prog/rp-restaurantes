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
    <div style={{ minHeight: '100vh', width: '100%', background: '#f6f6f7', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-plus-jakarta, system-ui, sans-serif)' }}>

      {/* TOPBAR */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ededef', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href={`/tpv/comanda/${orderId}`}
            style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, border: '1px solid #e8e8ea', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4d5159', textDecoration: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4 }}>Cobrar</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#9a9da3', marginTop: 1 }}>
              MESA {order.table.name} · #{String(order.order_number).padStart(4, '0')}
            </div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f4f4f5', border: '1px solid #e9e9eb', borderRadius: 999, padding: '5px 11px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16876a' }}></span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5, fontWeight: 600, color: '#71757c', letterSpacing: 0.3 }}>ABIERTA</span>
          </span>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 20px 32px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <PaymentForm order={{ ...order, items: activeItems }} />
        </div>
      </div>
    </div>
  )
}
