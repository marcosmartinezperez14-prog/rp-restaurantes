'use client'

import { useState, useRef, useEffect } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
import { editarStock } from '@/app/actions/productos'
import EditProductModal from './EditProductModal'
import PurchaseModal from './PurchaseModal'
import StockModal from './StockModal'
import StockHistory from './StockHistory'

interface Props {
  product: ProductoConCategoria
  allCategories: Categoria[]
  onRefresh: () => void
}

export default function ProductRow({ product, allCategories, onRefresh }: Props) {
  const [modal, setModal] = useState<'edit' | 'purchase' | 'ajuste' | 'merma' | 'history' | null>(null)
  const [editingStock, setEditingStock] = useState(false)
  const [stockDraft, setStockDraft] = useState('')
  const [stockPending, setStockPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const stockLow = product.track_stock && product.stock !== null && product.stock_min !== null
    && product.stock <= product.stock_min
  const stockCritical = product.track_stock && product.stock !== null
    && product.stock_min !== null && product.stock <= product.stock_min * 0.5

  const categoryLabel = product.categories.length > 0
    ? product.categories.map(c => c.name).join(', ')
    : '—'

  function startEditStock() {
    setStockDraft(String(product.stock ?? 0))
    setEditingStock(true)
  }

  async function saveStock() {
    const val = parseInt(stockDraft, 10)
    if (isNaN(val)) { setEditingStock(false); return }
    setStockPending(true)
    await editarStock(product.id, val)
    setStockPending(false)
    setEditingStock(false)
    onRefresh()
  }

  useEffect(() => {
    if (editingStock) inputRef.current?.focus()
  }, [editingStock])

  return (
    <>
      <tr className={`border-b border-[var(--border)] hover:bg-[var(--bg-surface-hover)] ${!product.is_visible ? 'opacity-50' : ''}`}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {stockCritical && <span title="Stock crítico" className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
            {!stockCritical && stockLow && <span title="Stock bajo" className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
            <span className="text-sm font-medium text-[var(--text-primary)]">{product.name}</span>
            {!product.is_available && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase font-semibold">No disp.</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{categoryLabel}</td>
        <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
          {product.cost_price !== null ? `${product.cost_price.toFixed(2)} €` : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right">
          {editingStock ? (
            <div className="flex items-center justify-end gap-1">
              <input
                ref={inputRef}
                type="number"
                value={stockDraft}
                disabled={stockPending}
                onChange={e => setStockDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveStock()
                  if (e.key === 'Escape') setEditingStock(false)
                }}
                onBlur={() => setEditingStock(false)}
                className="w-20 text-right border border-blue-400 rounded px-1 py-0.5 text-sm text-black focus:outline-none"
              />
              {stockPending && <span className="text-[var(--text-secondary)] text-xs animate-pulse">...</span>}
            </div>
          ) : (
            <span
              onClick={startEditStock}
              title="Clic para editar stock"
              className={`cursor-pointer ${
                product.track_stock
                  ? stockCritical ? 'text-red-600 font-bold' : stockLow ? 'text-amber-600 font-semibold' : 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {product.stock ?? 0}
              {product.track_stock && product.stock_min !== null && (
                <span className="text-[var(--text-secondary)] text-xs"> / mín {product.stock_min}</span>
              )}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{product.supplier ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1 justify-end flex-wrap">
            <button onClick={() => setModal('edit')}
              className="px-2 py-1 text-xs border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-slate-100">
              Editar
            </button>
            <button onClick={() => setModal('purchase')}
              className="px-2 py-1 text-xs bg-green-50 border border-green-200 rounded-lg text-green-700 hover:bg-green-100">
              Compra
            </button>
            <button onClick={() => setModal('ajuste')}
              className="px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded-lg text-amber-700 hover:bg-amber-100">
              Ajuste
            </button>
            <button onClick={() => setModal('merma')}
              className="px-2 py-1 text-xs bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100">
              Merma
            </button>
            <button onClick={() => setModal(modal === 'history' ? null : 'history')}
              className="px-2 py-1 text-xs bg-slate-100 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-slate-200">
              Historial
            </button>
          </div>
        </td>
      </tr>
      {modal === 'history' && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-8 pb-3 pt-1">
            <StockHistory productId={product.id} />
          </td>
        </tr>
      )}
      {modal === 'edit' && (
        <EditProductModal
          product={product}
          allCategories={allCategories}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
      {modal === 'purchase' && (
        <PurchaseModal product={product} onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === 'ajuste' && (
        <StockModal product={product} mode="ajuste" onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === 'merma' && (
        <StockModal product={product} mode="merma" onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
    </>
  )
}
