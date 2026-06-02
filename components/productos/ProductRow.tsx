'use client'

import { useState } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
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

  const margin = product.cost_price !== null
    ? product.price - product.cost_price
    : null
  const marginPct = margin !== null && product.cost_price && product.cost_price > 0
    ? (margin / product.cost_price) * 100
    : null

  const stockLow = product.track_stock && product.stock !== null && product.stock_min !== null
    && product.stock <= product.stock_min
  const stockCritical = product.track_stock && product.stock !== null
    && product.stock_min !== null && product.stock <= product.stock_min * 0.5

  const categoryLabel = product.categories.length > 0
    ? product.categories.map(c => c.name).join(', ')
    : '—'

  return (
    <>
      <tr className={`border-b border-[#f1f5f9] hover:bg-slate-50 ${!product.is_visible ? 'opacity-50' : ''}`}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {stockCritical && <span title="Stock crítico" className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
            {!stockCritical && stockLow && <span title="Stock bajo" className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
            <span className="text-sm font-medium text-[#0f172a]">{product.name}</span>
            {!product.is_available && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase font-semibold">No disp.</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-[#64748b]">{categoryLabel}</td>
        <td className="px-4 py-3 text-sm text-right font-semibold text-[#0f172a]">{product.price.toFixed(2)} €</td>
        <td className="px-4 py-3 text-sm text-right text-[#64748b]">
          {product.cost_price !== null ? `${product.cost_price.toFixed(2)} €` : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right">
          {margin !== null ? (
            <span className={margin >= 0 ? 'text-green-700' : 'text-red-600'}>
              {margin.toFixed(2)} €{marginPct !== null ? ` (${marginPct.toFixed(0)}%)` : ''}
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right">
          {product.track_stock ? (
            <span className={stockCritical ? 'text-red-600 font-bold' : stockLow ? 'text-amber-600 font-semibold' : 'text-[#0f172a]'}>
              {product.stock ?? 0}
              {product.stock_min !== null && <span className="text-[#94a3b8] text-xs"> / mín {product.stock_min}</span>}
            </span>
          ) : <span className="text-[#94a3b8] text-xs">Sin control</span>}
        </td>
        <td className="px-4 py-3 text-xs text-[#64748b]">{product.supplier ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1 justify-end flex-wrap">
            <button onClick={() => setModal('edit')}
              className="px-2 py-1 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-100">
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
              className="px-2 py-1 text-xs bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200">
              Historial
            </button>
          </div>
        </td>
      </tr>
      {modal === 'history' && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-8 pb-3 pt-1">
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
