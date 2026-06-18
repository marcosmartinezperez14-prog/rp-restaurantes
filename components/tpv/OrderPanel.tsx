'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderItem, OrderWithItems } from '@/app/actions/tpv'
import { updateOrderItemNote, markOrderItemServed } from '@/app/actions/tpv'
import { useOfflineFetch } from '@/lib/offline/useOfflineFetch'

interface Props {
  order: OrderWithItems
  items: OrderItem[]
  onItemsChange: (items: OrderItem[]) => void
}

function formatElapsed(openedAt: string): string {
  const diff = Date.now() - new Date(openedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function OrderPanel({ order, items, onItemsChange }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { offlineFetch } = useOfflineFetch()

  const taxMap = new Map<number, { base: number; tax: number }>()
  let subtotal = 0
  for (const item of items) {
    const base = item.total_price / (1 + item.tax_rate / 100)
    const tax = item.total_price - base
    subtotal += base
    const prev = taxMap.get(item.tax_rate) ?? { base: 0, tax: 0 }
    taxMap.set(item.tax_rate, { base: prev.base + base, tax: prev.tax + tax })
  }
  const totalAmount = items.reduce((s, i) => s + i.total_price, 0)

  const canCancel = items.every(i => i.status !== 'served' && i.status !== 'ready')

  function handleNoteBlur(item: OrderItem, note: string) {
    if (note === (item.notes ?? '')) return
    onItemsChange(items.map(i => i.id === item.id ? { ...i, notes: note || null } : i))
    startTransition(async () => { await updateOrderItemNote(item.id, note) })
  }

  function handleQuantityChange(item: OrderItem, delta: number) {
    const newQty = item.quantity + delta
    startTransition(async () => {
      if (newQty <= 0) {
        const result = await offlineFetch({
          // TODO: OperationType podría añadir 'cancel_order_item' para mejor diagnóstico
          type: 'change_table_status', // closest available type
          endpoint: `/api/tpv/order-items/${item.id}`,
          method: 'PATCH',
          payload: { quantity: 0 },
        })
        if (!result.ok) {
          console.error('Error al actualizar cantidad:', result.error)
          return
        }
        if (result.offline) {
          return // encolado, UI ya actualizada optimistamente
        }
        onItemsChange(items.filter(i => i.id !== item.id))
      } else {
        const result = await offlineFetch({
          // TODO: OperationType podría añadir 'update_item_quantity' para mejor diagnóstico
          type: 'change_table_status', // closest available type
          endpoint: `/api/tpv/order-items/${item.id}`,
          method: 'PATCH',
          payload: { quantity: newQty },
        })
        if (!result.ok) {
          console.error('Error al actualizar cantidad:', result.error)
          return
        }
        if (result.offline) {
          return // encolado, UI ya actualizada optimistamente
        }
        onItemsChange(
          items.map(i =>
            i.id === item.id
              ? { ...i, quantity: newQty, total_price: i.unit_price * newQty }
              : i
          )
        )
      }
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await offlineFetch({
        // TODO: OperationType podría añadir 'cancel_order' para mejor diagnóstico
        type: 'change_table_status', // closest available type
        endpoint: `/api/tpv/orders/${order.id}`,
        method: 'DELETE',
        payload: {},
      })
      if (!result.ok) {
        console.error('Error al cancelar:', result.error)
        return
      }
      if (result.offline) {
        // encolado — no redirigir hasta que se sincronice
        return
      }
      router.push('/tpv') // solo redirigir si la operación fue online exitosa
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-surface)] border-l border-[var(--border)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex-shrink-0">
        <h2 className="font-bold text-[var(--text-primary)]">{order.table.name}</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Abierta {formatElapsed(order.opened_at)} · #{String(order.order_number).padStart(4, '0')}
        </p>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {items.length === 0 && (
          <p className="text-center text-[var(--text-muted)] text-sm py-8">Sin productos</p>
        )}
        {items.map(item => (
          <div
            key={item.id}
            className={`border rounded-xl p-3 transition-colors ${
              item.status === 'ready'
                ? 'border-green-400 bg-green-50'
                : 'border-[var(--border)]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[var(--text-primary)] truncate">{item.product_name}</p>
                {item.modifiers_snapshot.length > 0 && (
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {item.modifiers_snapshot.map(m => m.option_name).join(' · ')}
                  </p>
                )}
                {item.modifiers_snapshot.length === 0 && item.modifiers.length > 0 && (
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {item.modifiers.map(m => m.name).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-[var(--text-secondary)] italic truncate">
                    {item.notes}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="font-semibold text-sm text-[var(--text-primary)]">
                  {Number(item.total_price).toFixed(2)} €
                </span>
                {item.status === 'preparing' && (
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                    Preparando
                  </span>
                )}
                {item.status === 'ready' && (
                  <span className="text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                    ¡Listo!
                  </span>
                )}
                {item.status === 'served' && (
                  <span className="text-[10px] font-semibold bg-slate-100 text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full">
                    Servido
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => handleQuantityChange(item, -1)}
                disabled={isPending}
                className="w-7 h-7 rounded-full border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 font-bold text-base leading-none"
              >
                −
              </button>
              <span className="text-sm font-semibold text-[var(--text-primary)] min-w-[1.5rem] text-center">
                {item.quantity}
              </span>
              <button
                onClick={() => handleQuantityChange(item, 1)}
                disabled={isPending}
                className="w-7 h-7 rounded-full border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 font-bold text-base leading-none"
              >
                +
              </button>
            </div>
            {item.status === 'ready' && (
              <button
                onClick={() => {
                  startTransition(async () => {
                    await markOrderItemServed(item.id)
                    onItemsChange(items.map(i => i.id === item.id ? { ...i, status: 'served' } : i))
                  })
                }}
                disabled={isPending}
                className="mt-2 w-full py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                ✓ Servir plato
              </button>
            )}
            <input
              type="text"
              defaultValue={item.notes ?? ''}
              placeholder="Nota para cocina..."
              onBlur={e => handleNoteBlur(item, e.target.value)}
              className="mt-2 w-full px-2 py-1 text-xs border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] text-[var(--text-secondary)] placeholder-[var(--text-muted)]"
            />
          </div>
        ))}
      </div>

      {/* Totals + Actions */}
      <div className="p-4 border-t border-[var(--border)] flex-shrink-0 flex flex-col gap-2">
        <div className="flex justify-between text-sm text-[var(--text-secondary)]">
          <span>Subtotal</span>
          <span>{Number(subtotal).toFixed(2)} €</span>
        </div>
        {Array.from(taxMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([rate, v]) => (
            <div key={rate} className="flex justify-between text-sm text-[var(--text-secondary)]">
              <span>IVA ({rate}%)</span>
              <span>{Number(v.tax).toFixed(2)} €</span>
            </div>
          ))}
        <div className="flex justify-between font-bold text-[var(--text-primary)] border-t border-[var(--border)] pt-2 mt-1">
          <span>TOTAL</span>
          <span>{Number(totalAmount).toFixed(2)} €</span>
        </div>

        <button
          onClick={() => router.push(`/tpv/cobro/${order.id}`)}
          disabled={isPending || items.length === 0}
          style={{ minHeight: '44px', fontWeight: 700 }}
          className="mt-1 w-full py-3 bg-[var(--primary)] text-white rounded-xl text-sm hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cobrar — {Number(totalAmount).toFixed(2)} €
        </button>

        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="w-full py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50"
          >
            Cancelar comanda
          </button>
        )}
      </div>
    </div>
  )
}
