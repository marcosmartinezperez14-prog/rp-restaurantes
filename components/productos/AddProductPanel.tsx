'use client'

import { useState, useTransition } from 'react'
import type { Categoria } from '@/app/actions/productos'
import { createProduct } from '@/app/actions/productos'

const TAX_OPTIONS = [
  { value: 4,  label: '4% — Superreducido' },
  { value: 10, label: '10% — Reducido' },
  { value: 21, label: '21% — General' },
]

interface Props {
  categories: Categoria[]
  onClose: () => void
  onSaved: () => void
}

export default function AddProductPanel({ categories, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [taxRate, setTaxRate] = useState(10)
  const [stock, setStock] = useState('0')
  const [stockMin, setStockMin] = useState('0')
  const [trackStock, setTrackStock] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [sku, setSku] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const priceNum = parseFloat(price.replace(',', '.'))
    const costNum = costPrice.trim() ? parseFloat(costPrice.replace(',', '.')) : undefined
    const stockNum = parseFloat(stock) || 0
    const stockMinNum = parseFloat(stockMin) || 0

    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (!categoryId) { setError('Selecciona una categoría'); return }
    if (isNaN(priceNum) || priceNum <= 0) { setError('El precio de venta debe ser mayor que 0'); return }
    if (costNum !== undefined && (isNaN(costNum) || costNum < 0)) {
      setError('El precio de compra no puede ser negativo')
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await createProduct({
        name,
        categoryId,
        description: description || undefined,
        price: priceNum,
        costPrice: costNum,
        taxRate,
        stock: stockNum,
        stockMin: stockMinNum,
        trackStock,
        supplier: supplier || undefined,
        sku: sku || undefined,
        isAvailable,
        isVisible,
      })
      if ('error' in res) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const inputClass = 'border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 w-full'
  const labelClass = 'flex flex-col gap-1'
  const labelTextClass = 'text-xs font-medium text-[#64748b]'

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
          <h2 className="text-[15px] font-bold text-[#0f172a]">Nuevo producto</h2>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#0f172a] text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Nombre */}
          <label className={labelClass}>
            <span className={labelTextClass}>Nombre *</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Coca-Cola 33cl"
              className={inputClass}
            />
          </label>

          {/* Categoría */}
          <label className={labelClass}>
            <span className={labelTextClass}>Categoría *</span>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className={`${inputClass} bg-white`}
            >
              <option value="">Selecciona una categoría</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {/* Descripción */}
          <label className={labelClass}>
            <span className={labelTextClass}>Descripción</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Descripción opcional del producto..."
              className={`${inputClass} resize-none`}
            />
          </label>

          {/* Precio venta + Precio compra */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Precio venta (€) *</span>
              <input
                value={price}
                onChange={e => setPrice(e.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Precio compra (€)</span>
              <input
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className={inputClass}
              />
            </label>
          </div>

          {/* IVA */}
          <label className={labelClass}>
            <span className={labelTextClass}>IVA aplicable *</span>
            <select
              value={taxRate}
              onChange={e => setTaxRate(Number(e.target.value))}
              className={`${inputClass} bg-white`}
            >
              {TAX_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {/* Stock actual + Stock mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Stock actual</span>
              <input
                value={stock}
                onChange={e => setStock(e.target.value)}
                type="number"
                min="0"
                step="0.001"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Stock mínimo</span>
              <input
                value={stockMin}
                onChange={e => setStockMin(e.target.value)}
                type="number"
                min="0"
                step="0.001"
                className={inputClass}
              />
            </label>
          </div>

          {/* Controlar stock */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={trackStock}
              onChange={e => setTrackStock(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
            <span className="text-sm text-[#0f172a]">Controlar stock</span>
          </label>

          {/* Proveedor + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Proveedor</span>
              <input
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="Nombre del proveedor"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>SKU / código interno</span>
              <input
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="SKU-001"
                className={inputClass}
              />
            </label>
          </div>

          {/* Disponible + Visible */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={e => setIsAvailable(e.target.checked)}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-[#0f172a]">Disponible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={e => setIsVisible(e.target.checked)}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-[#0f172a]">Visible en carta</span>
            </label>
          </div>

        </div>

        {/* Footer fijo */}
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex-shrink-0">
          {error && (
            <p className="text-red-600 text-xs mb-3">{error}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Guardar producto'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
