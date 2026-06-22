'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderWithItems, OrderItem, Category, ProductWithModifiers } from '@/app/actions/tpv'
import type { ItemConModificadores } from '@/types/modificadores'
import { getOrderItemStatuses } from '@/app/actions/tpv'
import { useOfflineFetch } from '@/lib/offline/useOfflineFetch'
import ProductsPanel from './ProductsPanel'
import OrderPanel from './OrderPanel'

interface Props {
  order: OrderWithItems
  categories: Category[]
  products: ProductWithModifiers[]
}

type Toast = { id: string; product_name: string; quantity: number }

const POLL_MS = 3000

export default function OrderView({ order, categories, products }: Props) {
  const [items, setItems] = useState<OrderItem[]>(order.items)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isPending, setIsPending] = useState(false)
  const [tab, setTab] = useState<'prod' | 'com'>('prod')
  const [isPendingCancel, startCancelTransition] = useTransition()
  const itemsRef = useRef<OrderItem[]>(order.items)
  const notifiedRef = useRef<Set<string>>(new Set())
  const { offlineFetch } = useOfflineFetch()
  const router = useRouter()

  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      if (!mounted) return
      const statuses = await getOrderItemStatuses(order.id)
      if (!mounted) return
      const prev = itemsRef.current
      const newToasts: Toast[] = []
      let hasChanges = false
      const next = prev.map(item => {
        const fresh = statuses.find(s => s.id === item.id)
        if (!fresh || fresh.status === item.status) return item
        hasChanges = true
        if (fresh.status === 'ready' && !notifiedRef.current.has(item.id)) {
          notifiedRef.current.add(item.id)
          newToasts.push({ id: item.id, product_name: item.product_name, quantity: item.quantity })
        }
        return { ...item, status: fresh.status }
      })
      if (hasChanges) setItems(next)
      for (const toast of newToasts) {
        setToasts(t => [...t, toast])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== toast.id)), 7000)
      }
    }
    const interval = setInterval(poll, POLL_MS)
    return () => { mounted = false; clearInterval(interval) }
  }, [order.id])

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  async function handleAddProduct(resultado: ItemConModificadores) {
    setIsPending(true)
    const result = await offlineFetch({
      type: 'add_item',
      endpoint: '/api/tpv/order-items',
      method: 'POST',
      payload: {
        orderId: order.id,
        productId: resultado.menu_item_id,
        quantity: resultado.cantidad,
        unit_price: resultado.precio_final,
        modifiers_snapshot: resultado.modifiers_snapshot,
        nota: resultado.nota,
      },
    })
    setIsPending(false)
    if (!result.ok) {
      alert('Error al añadir: ' + (result.error ?? 'Error desconocido'))
      return
    }
    const product = products.find(p => p.id === resultado.menu_item_id)
    if (!product) return
    const newItem: OrderItem = {
      id: result.offline ? `offline-${Date.now()}` : (result.data as { itemId: string }).itemId,
      product_name: product.name,
      product_price: product.price,
      tax_rate: product.tax_rate,
      quantity: resultado.cantidad,
      unit_price: resultado.precio_final,
      total_price: resultado.precio_final * resultado.cantidad,
      modifiers: resultado.modifiers_snapshot.map(s => ({
        option_id: s.option_id,
        name: s.option_name,
        price_adjustment: s.price_delta,
      })),
      modifiers_snapshot: resultado.modifiers_snapshot,
      notes: resultado.nota ?? null,
      status: 'pending',
    }
    setItems(prev => [...prev, newItem])
  }

  function handleCancel() {
    startCancelTransition(async () => {
      const result = await offlineFetch({
        type: 'change_table_status',
        endpoint: `/api/tpv/orders/${order.id}`,
        method: 'DELETE',
        payload: {},
      })
      if (!result.ok) return
      if (!result.offline) router.push('/tpv')
    })
  }

  const totalAmount = items.reduce((s, i) => s + i.total_price, 0)
  const subtotal = items.reduce((s, i) => s + i.total_price / (1 + i.tax_rate / 100), 0)
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)
  const canCancel = items.every(i => i.status !== 'served' && i.status !== 'ready')

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="absolute top-3 right-3 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-xl shadow-xl min-w-[230px]"
            >
              <span className="text-xl">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">¡Plato listo!</p>
                <p className="text-sm font-bold truncate">
                  {toast.product_name}{toast.quantity > 1 ? ` ×${toast.quantity}` : ''}
                </p>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-white/60 hover:text-white text-lg leading-none shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* DESKTOP: side by side */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex-[3] overflow-hidden">
          <ProductsPanel
            categories={categories}
            products={products}
            onAddProduct={handleAddProduct}
            disabled={isPending}
          />
        </div>
        <div className="flex-[2] overflow-hidden">
          <OrderPanel
            order={order}
            items={items}
            onItemsChange={setItems}
          />
        </div>
      </div>

      {/* MOBILE: tabs */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden bg-[#f6f6f7]">
        {/* Segmented tabs */}
        <div className="bg-white border-b border-[#ededef] px-3 pt-2 pb-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1 bg-[#f3f3f5] border border-[#e9e9eb] rounded-xl p-1">
            <button
              onClick={() => setTab('prod')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-[9px] text-[13.5px] font-bold transition-all ${
                tab === 'prod'
                  ? 'bg-white text-[#181b21] shadow-sm'
                  : 'text-[#82858d]'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
              Productos
            </button>
            <button
              onClick={() => setTab('com')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-[9px] text-[13.5px] font-bold transition-all ${
                tab === 'com'
                  ? 'bg-white text-[#181b21] shadow-sm'
                  : 'text-[#82858d]'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h2l1.6 10.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H7"/>
                <circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>
              </svg>
              Comanda
              <span className={`font-mono text-[11px] font-bold min-w-[19px] h-[19px] px-1.5 rounded-[6px] flex items-center justify-center transition-colors ${
                itemCount > 0
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[#e3e3e5] text-[#9a9da3]'
              }`}>
                {itemCount}
              </span>
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          {tab === 'prod' ? (
            <ProductsPanel
              categories={categories}
              products={products}
              onAddProduct={(r) => { handleAddProduct(r); setTab('com') }}
              disabled={isPending}
            />
          ) : (
            <OrderPanel
              order={order}
              items={items}
              onItemsChange={setItems}
              hideFooter
            />
          )}
        </div>

        {/* Bottom checkout bar — always visible on mobile */}
        <div className="flex-shrink-0 bg-white border-t border-[#ededef] px-4 pt-3 pb-4 shadow-[0_-8px_24px_rgba(20,23,29,0.05)]">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[12.5px] text-[#9a9da3] font-medium">Subtotal</span>
            <span className="text-[12.5px] text-[#9a9da3] font-mono">{subtotal.toFixed(2)} €</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[16px] font-extrabold tracking-tight">TOTAL</span>
            <span className="text-[20px] font-bold tracking-tight font-mono">{totalAmount.toFixed(2)} €</span>
          </div>
          <div className="flex gap-2.5">
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={isPendingCancel}
                className="w-[52px] h-[50px] flex-shrink-0 flex items-center justify-center rounded-[13px] border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 1.8H8A2 2 0 0 1 6 20L5 6"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => router.push(`/tpv/cobro/${order.id}`)}
              disabled={isPending || items.length === 0}
              className="flex-1 h-[50px] flex items-center justify-center gap-2 rounded-[13px] bg-[var(--primary)] text-white text-[15px] font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:brightness-110 active:scale-[0.99]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>
              </svg>
              Cobrar — {totalAmount.toFixed(2)} €
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
