'use client'

import { useState, useTransition, useEffect } from 'react'
import type { StockMovement } from '@/app/actions/productos'
import { getStockMovements } from '@/app/actions/productos'

const TYPE_CONFIG = {
  compra:  { label: 'Compra',  color: 'text-green-700 bg-green-50' },
  venta:   { label: 'Venta',   color: 'text-blue-700 bg-blue-50' },
  ajuste:  { label: 'Ajuste',  color: 'text-amber-700 bg-amber-50' },
  merma:   { label: 'Merma',   color: 'text-red-700 bg-red-50' },
}

export default function StockHistory({ productId }: { productId: string }) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const data = await getStockMovements(productId)
      setMovements(data)
    })
  }, [productId])

  if (isPending) return <p className="text-xs text-[#94a3b8] py-2">Cargando historial...</p>
  if (movements.length === 0) return <p className="text-xs text-[#94a3b8] py-2">Sin movimientos</p>

  return (
    <div className="flex flex-col gap-1 mt-2">
      {movements.map(m => {
        const cfg = TYPE_CONFIG[m.type]
        const sign = m.type === 'merma' ? '-' : m.type === 'venta' ? '-' : '+'
        return (
          <div key={m.id} className="flex items-center gap-2 text-xs py-1 border-b border-[#f1f5f9] last:border-0">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
            <span className="font-semibold text-[#0f172a]">{sign}{m.quantity}</span>
            {m.cost_price !== null && <span className="text-[#64748b]">{Number(m.cost_price).toFixed(2)} €/u</span>}
            {m.purchase_date && <span className="text-[#94a3b8]">{m.purchase_date}</span>}
            {m.notes && <span className="text-[#94a3b8] truncate">{m.notes}</span>}
            <span className="ml-auto text-[#94a3b8] flex-shrink-0">
              {new Date(m.created_at).toLocaleDateString('es-ES')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
