'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderItem, OrderWithItems } from '@/app/actions/tpv'
import { updateOrderItemQuantity, removeOrderItem, cancelOrder, updateOrderItemNote } from '@/app/actions/tpv'

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
        await removeOrderItem(item.id)
        onItemsChange(items.filter(i => i.id !== item.id))
      } else {
        await updateOrderItemQuantity(item.id, newQty)
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
      const result = await cancelOrder(order.id)
      if (!result.error) router.push('/tpv')
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white border-l border-[#e2e8f0]">
      {/* Header */}
      <div className="p-4 border-b border-[#e2e8f0] flex-shrink-0">
        <h2 className="font-bold text-[#0f172a]">{order.table.name}</h2>
        <p className="text-sm text-[#64748b]">
          Abierta {formatElapsed(order.opened_at)} · #{String(order.order_number).padStart(4, '0')}
        </p>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {items.length === 0 && (
          <p className="text-center text-[#94a3b8] text-sm py-8">Sin productos</p>
        )}
        {items.map(item => (
          <div key={item.id} className="border border-[#e2e8f0] rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[#0f172a] truncate">{item.product_name}</p>
                {item.modifiers.length > 0 && (
                  <p className="text-xs text-[#64748b] truncate">
                    {item.modifiers.map(m => m.name).join(', ')}
                  </p>
                )}
              </div>
              <span className="font-semibold text-sm text-[#0f172a] flex-shrink-0">
                {Number(item.total_price).toFixed(2)} €
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => handleQuantityChange(item, -1)}
                disabled={isPending}
                className="w-7 h-7 rounded-full border border-[#e2e8f0] text-[#64748b] flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 font-bold text-base leading-none"
              >
                −
              </button>
              <span className="text-sm font-semibold text-[#0f172a] min-w-[1.5rem] text-center">
                {item.quantity}
              </span>
              <button
                onClick={() => handleQuantityChange(item, 1)}
                disabled={isPending}
                className="w-7 h-7 rounded-full border border-[#e2e8f0] text-[#64748b] flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 font-bold text-base leading-none"
              >
                +
              </button>
            </div>
            <input
              type="text"
              defaultValue={item.notes ?? ''}
              placeholder="Nota para cocina..."
              onBlur={e => handleNoteBlur(item, e.target.value)}
              className="mt-2 w-full px-2 py-1 text-xs border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb] text-[#64748b] placeholder-[#94a3b8]"
            />
          </div>
        ))}
      </div>

      {/* Totals + Actions */}
      <div className="p-4 border-t border-[#e2e8f0] flex-shrink-0 flex flex-col gap-2">
        <div className="flex justify-between text-sm text-[#64748b]">
          <span>Subtotal</span>
          <span>{Number(subtotal).toFixed(2)} €</span>
        </div>
        {Array.from(taxMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([rate, v]) => (
            <div key={rate} className="flex justify-between text-sm text-[#64748b]">
              <span>IVA ({rate}%)</span>
              <span>{Number(v.tax).toFixed(2)} €</span>
            </div>
          ))}
        <div className="flex justify-between font-bold text-[#0f172a] border-t border-[#e2e8f0] pt-2 mt-1">
          <span>TOTAL</span>
          <span>{Number(totalAmount).toFixed(2)} €</span>
        </div>

        <button
          onClick={() => router.push(`/tpv/cobro/${order.id}`)}
          disabled={isPending || items.length === 0}
          style={{ minHeight: '44px', fontWeight: 700 }}
          className="mt-1 w-full py-3 bg-[#2563eb] text-white rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
