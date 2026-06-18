'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria, Categoria, ProductUnit } from '@/app/actions/productos'
import { updateProducto } from '@/app/actions/productos'

const UNIT_OPTIONS = [
  { value: 'unit',  label: 'Unidad' },
  { value: 'kg',    label: 'Kilogramo (kg)' },
  { value: 'g',     label: 'Gramo (g)' },
  { value: 'l',     label: 'Litro (l)' },
  { value: 'ml',    label: 'Mililitro (ml)' },
  { value: 'dozen', label: 'Docena' },
] as const satisfies { value: ProductUnit; label: string }[]

interface Props {
  product: ProductoConCategoria
  allCategories: Categoria[]
  onClose: () => void
  onSaved: () => void
}

export default function EditProductModal({ product, allCategories, onClose, onSaved }: Props) {
  const [costPrice, setCostPrice] = useState(product.cost_price?.toFixed(2) ?? '')
  const [stockMin, setStockMin] = useState(product.stock_min?.toString() ?? '')
  const [supplier, setSupplier] = useState(product.supplier ?? '')
  const [trackStock, setTrackStock] = useState(product.track_stock)
  const [isAvailable, setIsAvailable] = useState(product.is_available)
  const [unit, setUnit] = useState<ProductUnit>(product.unit ?? 'unit')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    product.categories.map(c => c.id)
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleCategory(id: string) {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSave() {
    const costNum = costPrice ? parseFloat(costPrice.replace(',', '.')) : null
    const minNum = stockMin ? parseInt(stockMin) : null

    setError(null)
    startTransition(async () => {
      const res = await updateProducto(product.id, {
        cost_price: costNum,
        stock_min: minNum,
        supplier: supplier.trim() || null,
        track_stock: trackStock,
        is_available: isAvailable,
        unit,
        categoryIds: selectedCategoryIds,
      })
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const categoryNames = product.categories.map(c => c.name).join(', ') || '—'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-[var(--text-primary)]">{product.name}</h2>
          <p className="text-xs text-[var(--text-secondary)]">{categoryNames}</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Precio coste (€)</span>
            <input value={costPrice} onChange={e => setCostPrice(e.target.value)}
              placeholder="0.00"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Proveedor</span>
            <input value={supplier} onChange={e => setSupplier(e.target.value)}
              placeholder="Nombre del proveedor"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Stock mínimo</span>
            <input value={stockMin} onChange={e => setStockMin(e.target.value)}
              type="number" min="0" placeholder="0"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400" />
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Unidad de medida</label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value as ProductUnit)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400"
            >
              {UNIT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* Categorías */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Categorías</span>
            <div className="border border-[var(--border)] rounded-lg p-2 flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {allCategories.length === 0 && (
                <p className="text-xs text-[var(--text-secondary)] py-1 px-1">Sin categorías disponibles</p>
              )}
              {allCategories.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-[var(--bg-page)] rounded">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trackStock} onChange={e => setTrackStock(e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-[var(--text-primary)]">Control de stock</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-[var(--text-primary)]">Disponible</span>
            </label>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)]">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
