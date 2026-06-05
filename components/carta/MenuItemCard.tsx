'use client'

import { useTransition } from 'react'
import type { MenuItem } from '@/app/actions/productos'
import { updateMenuItem, deleteMenuItem } from '@/app/actions/productos'

function marginColorClass(margin: number): string {
  if (margin < 30) return 'text-red-600 bg-red-50'
  if (margin < 60) return 'text-amber-600 bg-amber-50'
  return 'text-green-700 bg-green-50'
}

interface Props {
  item: MenuItem
  onEdit: (item: MenuItem) => void
  onRefresh: () => void
}

export default function MenuItemCard({ item, onEdit, onRefresh }: Props) {
  const [isPending, startTransition] = useTransition()

  const totalCost = item.ingredients.reduce((sum, ing) => {
    return sum + ((ing.product?.cost_price ?? 0) * ing.quantity)
  }, 0)

  const margin = item.price > 0 ? ((item.price - totalCost) / item.price) * 100 : 0

  function handleToggleActive() {
    startTransition(async () => {
      await updateMenuItem(item.id, { isActive: !item.is_active })
      onRefresh()
    })
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar "${item.name}"?`)) return
    startTransition(async () => {
      await deleteMenuItem(item.id)
      onRefresh()
    })
  }

  return (
    <div className={`bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm transition-opacity ${isPending ? 'opacity-60' : ''} ${!item.is_active ? 'opacity-70' : ''}`}>
      {item.image_url && (
        <div className="h-36 bg-slate-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#0f172a] text-sm">{item.name}</span>
              {!item.is_active && (
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-[#64748b]">
                  Inactivo
                </span>
              )}
              {item.category && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                  {item.category.name}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-[#64748b] mt-0.5 line-clamp-2">{item.description}</p>
            )}
          </div>
          <span className="font-bold text-[#0f172a] text-base whitespace-nowrap">
            {item.price.toFixed(2)} €
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#64748b]">
            Coste: <strong>{totalCost.toFixed(2)} €</strong>
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${marginColorClass(margin)}`}>
            {margin.toFixed(0)}% margen
          </span>
        </div>

        {item.ingredients.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase text-[#94a3b8] tracking-wide">
              {item.ingredients.length} ing.
            </span>
            {item.ingredients.slice(0, 3).map(ing => (
              <span key={ing.id} className="text-[10px] px-1.5 py-0.5 bg-slate-50 rounded text-[#64748b]">
                {ing.product?.name ?? '—'} ({ing.quantity}{ing.unit})
              </span>
            ))}
            {item.ingredients.length > 3 && (
              <span className="text-[10px] text-[#94a3b8]">+{item.ingredients.length - 3} más</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-[#f1f5f9] mt-1">
          <button
            onClick={handleToggleActive}
            disabled={isPending}
            className="flex-1 px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 disabled:opacity-50"
          >
            {item.is_active ? 'Desactivar' : 'Activar'}
          </button>
          <button
            onClick={() => onEdit(item)}
            disabled={isPending}
            className="flex-1 px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 disabled:opacity-50"
          >
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="px-2 py-1.5 text-xs border border-red-100 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
