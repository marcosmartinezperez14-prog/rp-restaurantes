'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { KitchenItem, KitchenStatus } from '@/app/actions/cocina'
import { getKitchenItems, updateKitchenItemStatus } from '@/app/actions/cocina'

interface Props {
  initialItems: KitchenItem[]
  restaurantId: string
}

const COLUMNS: { status: KitchenStatus; label: string; emptyText: string; headerBg: string; headerText: string; dot: string }[] = [
  {
    status: 'pending',
    label: 'Por hacer',
    emptyText: 'Sin platos pendientes',
    headerBg: 'bg-amber-400/10 border-amber-400/30',
    headerText: 'text-amber-600',
    dot: 'bg-amber-400',
  },
  {
    status: 'preparing',
    label: 'Preparando',
    emptyText: 'Nada en preparación',
    headerBg: 'bg-blue-500/10 border-blue-500/30',
    headerText: 'text-blue-600',
    dot: 'bg-blue-400',
  },
  {
    status: 'ready',
    label: 'Listo',
    emptyText: 'Nada listo aún',
    headerBg: 'bg-green-500/10 border-green-500/30',
    headerText: 'text-green-600',
    dot: 'bg-green-400',
  },
]

const NEXT_STATUS: Partial<Record<KitchenStatus, KitchenStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
}

const NEXT_LABEL: Partial<Record<KitchenStatus, string>> = {
  pending: 'Preparando',
  preparing: 'Listo',
}

const BTN_COLOR: Partial<Record<KitchenStatus, string>> = {
  pending: 'bg-[var(--accent)] hover:bg-blue-500',
  preparing: 'bg-green-600 hover:bg-green-500',
}

export default function CocinaClient({ initialItems, restaurantId }: Props) {
  const [items, setItems] = useState<KitchenItem[]>(initialItems)
  const [updating, setUpdating] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`cocina_${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          startTransition(async () => {
            const fresh = await getKitchenItems()
            setItems(fresh)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [restaurantId])

  async function handleAdvance(item: KitchenItem) {
    const nextStatus = NEXT_STATUS[item.status]
    if (!nextStatus) return

    setUpdating(item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: nextStatus } : i))

    const result = await updateKitchenItemStatus(item.id, nextStatus)
    setUpdating(null)

    if (result.error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i))
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {COLUMNS.map(col => {
        const colItems = items.filter(i => i.status === col.status)
        return (
          <div key={col.status} className="flex flex-col gap-3 min-h-0">
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${col.headerBg} shrink-0`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                <span className={`text-sm font-bold ${col.headerText}`}>{col.label}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.dot} text-black`}>
                {colItems.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5">
              {colItems.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] text-sm py-10">
                  {col.emptyText}
                </div>
              ) : (
                colItems.map(item => (
                  <KitchenCard
                    key={item.id}
                    item={item}
                    isUpdating={updating === item.id}
                    onAdvance={() => handleAdvance(item)}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KitchenCard({
  item,
  isUpdating,
  onAdvance,
}: {
  item: KitchenItem
  isUpdating: boolean
  onAdvance: () => void
}) {
  const minutesAgo = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000)
  const isOld = minutesAgo >= 10

  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-xl border-2 p-3 transition-colors ${
        isOld ? 'border-red-500/70' : 'border-[var(--border)]'
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-[var(--text-primary)] bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded-lg">
            {item.table_name}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">#{item.order_number}</span>
        </div>
        <span className={`text-xs font-medium shrink-0 ${isOld ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
          {minutesAgo < 1 ? 'Ahora' : `${minutesAgo} min`}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
          {item.product_name}
        </span>
        {item.quantity > 1 && (
          <span className="shrink-0 text-xs font-bold bg-[var(--text-primary)] text-[var(--bg-surface)] px-1.5 py-0.5 rounded-md">
            ×{item.quantity}
          </span>
        )}
      </div>

      {item.notes && (
        <p className="text-xs text-amber-700 bg-amber-400/10 rounded-lg px-2 py-1 mb-2">
          📝 {item.notes}
        </p>
      )}

      {NEXT_LABEL[item.status] ? (
        <button
          onClick={onAdvance}
          disabled={isUpdating}
          className={`w-full py-1.5 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-40 ${BTN_COLOR[item.status]}`}
        >
          {isUpdating ? '…' : NEXT_LABEL[item.status] + ' →'}
        </button>
      ) : (
        <p className="text-center text-xs text-green-600 font-semibold py-1">
          Esperando que el camarero sirva
        </p>
      )}
    </div>
  )
}
