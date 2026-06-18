'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderWithItems, PaymentMethod, ProcessPaymentParams } from '@/app/actions/tpv'
import { useOfflineFetch } from '@/lib/offline/useOfflineFetch'
import TicketPreview from '@/components/tpv/TicketPreview'

export default function PaymentForm({ order }: { order: OrderWithItems }) {
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [cashAmount, setCashAmount] = useState('')
  const [mixedCash, setMixedCash] = useState('')
  const [mixedCard, setMixedCard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [ticketId, setTicketId] = useState<string | null>(null)
  const router = useRouter()
  const { offlineFetch } = useOfflineFetch()

  const total = order.total
  const cashNum = parseFloat(cashAmount) || 0
  const change = cashNum - total
  const mixedCashNum = parseFloat(mixedCash) || 0
  const mixedCardNum = parseFloat(mixedCard) || 0
  const mixedValid = Math.abs(mixedCashNum + mixedCardNum - total) < 0.01

  function isValid(): boolean {
    if (method === 'cash') return cashNum >= total
    if (method === 'mixed') return mixedValid && mixedCashNum > 0 && mixedCardNum > 0
    return true
  }

  function buildParams(): ProcessPaymentParams {
    if (method === 'cash') return { method: 'cash', cashAmount: cashNum, changeGiven: Math.max(0, change) }
    if (method === 'card') return { method: 'card', amount: total }
    if (method === 'bizum') return { method: 'bizum', amount: total }
    return { method: 'mixed', cashAmount: mixedCashNum, cardAmount: mixedCardNum }
  }

  function handleConfirm() {
    setError(null)
    const params = buildParams()
    startTransition(async () => {
      const result = await offlineFetch({
        type: 'pay_order',
        endpoint: '/api/tpv/pay',
        method: 'POST',
        payload: { orderId: order.id, ...params },
      })
      if (!result.ok) { setError(result.error ?? 'Error al procesar el cobro'); return }
      if (result.offline) {
        // Encolado offline — redirigir al TPV
        router.push('/tpv')
        return
      }
      const data = result.data as { ticketId: string }
      setTicketId(data.ticketId)
    })
  }

  const METHODS: { id: PaymentMethod; label: string }[] = [
    { id: 'cash', label: 'Efectivo' },
    { id: 'card', label: 'Tarjeta' },
    { id: 'bizum', label: 'Bizum' },
    { id: 'mixed', label: 'Mixto' },
  ]

  return (
    <>
    {ticketId && (
      <TicketPreview
        ticketId={ticketId}
        onClose={() => { setTicketId(null); router.push('/tpv') }}
      />
    )}
    <div className="flex flex-col gap-5">
      {/* Total */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border)]">
        <p className="text-sm text-[var(--text-secondary)] mb-1">Total a cobrar</p>
        <p style={{ fontSize: '36px', fontWeight: 900 }} className="text-[var(--text-primary)]">
          {Number(total).toFixed(2)} €
        </p>
      </div>

      {/* Items summary */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)]">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Resumen</h3>
        <div className="flex flex-col gap-1.5">
          {order.items.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-[var(--text-primary)]">{item.product_name} ×{item.quantity}</span>
              <span className="text-[var(--text-secondary)]">{Number(item.total_price).toFixed(2)} €</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)]">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Método de pago</h3>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                method === m.id
                  ? 'bg-[#2563eb] text-white border-[#2563eb]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[#2563eb]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Total</span>
              <span className="font-semibold text-[var(--text-primary)]">{Number(total).toFixed(2)} €</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-[var(--text-secondary)] flex-shrink-0">Entrega cliente</label>
              <input
                type="number"
                value={cashAmount}
                onChange={e => setCashAmount(e.target.value)}
                placeholder="0.00"
                min={0}
                step="0.01"
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-right outline-none focus:border-[#2563eb]"
              />
            </div>
            {cashNum > 0 && change > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Cambio</span>
                <span className="font-semibold text-green-600">{Number(change).toFixed(2)} €</span>
              </div>
            )}
          </div>
        )}

        {method === 'mixed' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-[var(--text-secondary)] w-20 flex-shrink-0">Efectivo</label>
              <input
                type="number"
                value={mixedCash}
                onChange={e => setMixedCash(e.target.value)}
                placeholder="0.00"
                min={0}
                step="0.01"
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-right outline-none focus:border-[#2563eb]"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-[var(--text-secondary)] w-20 flex-shrink-0">Tarjeta</label>
              <input
                type="number"
                value={mixedCard}
                onChange={e => setMixedCard(e.target.value)}
                placeholder="0.00"
                min={0}
                step="0.01"
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-right outline-none focus:border-[#2563eb]"
              />
            </div>
            {(mixedCashNum > 0 || mixedCardNum > 0) && !mixedValid && (
              <p className="text-xs text-red-600">
                Los importes deben sumar {Number(total).toFixed(2)} €
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={!isValid() || isPending}
        style={{ minHeight: '56px', fontWeight: 700, fontSize: '1rem', background: '#15803d' }}
        className="w-full rounded-2xl text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Procesando...' : `Confirmar cobro — ${Number(total).toFixed(2)} €`}
      </button>
    </div>
    </>
  )
}
