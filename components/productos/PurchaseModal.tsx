'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria } from '@/app/actions/productos'
import { registrarCompra } from '@/app/actions/productos'

interface Props {
  product: ProductoConCategoria
  onClose: () => void
  onSaved: () => void
}

export default function PurchaseModal({ product, onClose, onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [quantity, setQuantity] = useState('')
  const [costPrice, setCostPrice] = useState(product.cost_price?.toFixed(2) ?? '')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const qty = parseFloat(quantity.replace(',', '.'))
    const cost = parseFloat(costPrice.replace(',', '.'))
    if (isNaN(qty) || qty <= 0) { setError('Cantidad inválida'); return }
    if (isNaN(cost) || cost < 0) { setError('Precio inválido'); return }
    if (!date) { setError('Introduce una fecha'); return }

    setError(null)
    startTransition(async () => {
      const res = await registrarCompra({
        productId: product.id,
        quantity: qty,
        costPrice: cost,
        purchaseDate: date,
        notes: notes.trim() || undefined,
      })
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-[var(--text-primary)]">Registrar compra</h2>
          <p className="text-xs text-[var(--text-secondary)]">{product.name}</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Cantidad</span>
            <input value={quantity} onChange={e => setQuantity(e.target.value)}
              type="number" min="0.01" step="0.01" placeholder="0"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Precio coste unitario (€)</span>
            <input value={costPrice} onChange={e => setCostPrice(e.target.value)}
              type="number" min="0" step="0.01" placeholder="0.00"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Fecha</span>
            <input value={date} onChange={e => setDate(e.target.value)}
              type="date"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Notas (opcional)</span>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Proveedor habitual"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)]">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-green-700 text-white font-semibold rounded-lg hover:bg-green-800 disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Registrar compra'}
          </button>
        </div>
      </div>
    </div>
  )
}
