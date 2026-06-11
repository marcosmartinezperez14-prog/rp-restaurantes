'use client'

import { useState, useEffect, useRef } from 'react'
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
  const itemsRef = useRef<OrderItem[]>(order.items)
  const notifiedRef = useRef<Set<string>>(new Set())
  const { offlineFetch } = useOfflineFetch()

  // Keep ref in sync with state
  useEffect(() => { itemsRef.current = items }, [items])

  // Poll kitchen statuses every 3 s
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

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Toast notifications — listo para sacar */}
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
  )
}
