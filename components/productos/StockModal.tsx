'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria } from '@/app/actions/productos'
import { ajustarStock } from '@/app/actions/productos'

interface Props {
  product: ProductoConCategoria
  mode: 'ajuste' | 'merma'
  onClose: () => void
  onSaved: () => void
}

export default function StockModal({ product, mode, onClose, onSaved }: Props) {
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const title = mode === 'merma' ? 'Registrar merma' : 'Ajustar stock'
  const btnColor = mode === 'merma' ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'

  function handleSave() {
    const qty = parseFloat(quantity.replace(',', '.'))
    if (isNaN(qty) || qty <= 0) { setError('Introduce una cantidad válida'); return }

    setError(null)
    startTransition(async () => {
      const res = await ajustarStock({
        productId: product.id,
        type: mode,
        quantity: qty,
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
          <h2 className="font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="text-xs text-[var(--text-secondary)]">{product.name} · Stock actual: {product.stock ?? 0}</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {mode === 'merma' ? 'Unidades perdidas' : 'Nuevo stock (ajuste a este valor)'}
            </span>
            <input value={quantity} onChange={e => setQuantity(e.target.value)}
              type="number" min="0.01" step="0.01" placeholder="0"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          {mode === 'ajuste' && (
            <p className="text-xs text-[var(--text-secondary)]">
              Stock resultante: {((Number(product.stock) || 0) + (parseFloat(quantity) || 0)).toFixed(2)}
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Motivo (opcional)</span>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Rotura, caducidad..."
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)]">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className={`px-4 py-2 text-sm text-white font-semibold rounded-lg disabled:opacity-50 ${btnColor}`}>
            {isPending ? 'Guardando...' : title}
          </button>
        </div>
      </div>
    </div>
  )
}
