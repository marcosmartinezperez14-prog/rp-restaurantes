'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
import { updateProducto } from '@/app/actions/productos'

interface Props {
  product: ProductoConCategoria
  allCategories: Categoria[]
  onClose: () => void
  onSaved: () => void
}

export default function EditProductModal({ product, allCategories, onClose, onSaved }: Props) {
  const [price, setPrice] = useState(product.price.toFixed(2))
  const [costPrice, setCostPrice] = useState(product.cost_price?.toFixed(2) ?? '')
  const [stockMin, setStockMin] = useState(product.stock_min?.toString() ?? '')
  const [supplier, setSupplier] = useState(product.supplier ?? '')
  const [trackStock, setTrackStock] = useState(product.track_stock)
  const [isAvailable, setIsAvailable] = useState(product.is_available)
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
    const priceNum = parseFloat(price.replace(',', '.'))
    const costNum = costPrice ? parseFloat(costPrice.replace(',', '.')) : null
    const minNum = stockMin ? parseInt(stockMin) : null
    if (isNaN(priceNum) || priceNum < 0) { setError('Precio de venta inválido'); return }

    setError(null)
    startTransition(async () => {
      const res = await updateProducto(product.id, {
        price: priceNum,
        cost_price: costNum,
        stock_min: minNum,
        supplier: supplier.trim() || null,
        track_stock: trackStock,
        is_available: isAvailable,
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-bold text-[#0f172a]">{product.name}</h2>
          <p className="text-xs text-[#64748b]">{categoryNames}</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Precio venta (€)</span>
              <input value={price} onChange={e => setPrice(e.target.value)}
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Precio coste (€)</span>
              <input value={costPrice} onChange={e => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Proveedor</span>
            <input value={supplier} onChange={e => setSupplier(e.target.value)}
              placeholder="Nombre del proveedor"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Stock mínimo</span>
            <input value={stockMin} onChange={e => setStockMin(e.target.value)}
              type="number" min="0" placeholder="0"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
          </label>
          {/* Categorías */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Categorías</span>
            <div className="border border-[#e2e8f0] rounded-lg p-2 flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {allCategories.length === 0 && (
                <p className="text-xs text-[#94a3b8] py-1 px-1">Sin categorías disponibles</p>
              )}
              {allCategories.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-slate-50 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className="text-sm text-[#0f172a]">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trackStock} onChange={e => setTrackStock(e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-[#0f172a]">Control de stock</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-[#0f172a]">Disponible</span>
            </label>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
