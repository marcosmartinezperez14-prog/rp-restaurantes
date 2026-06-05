'use client'

import { useState, useTransition } from 'react'
import type { ZoneWithTables } from '@/app/actions/tpv'
import { addZone } from '@/app/actions/tpv'

const COLORS = [
  { hex: '#64748b', label: 'Gris' },
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#22c55e', label: 'Verde' },
  { hex: '#f59e0b', label: 'Ámbar' },
  { hex: '#ef4444', label: 'Rojo' },
  { hex: '#a855f7', label: 'Morado' },
]

interface Props {
  onClose: () => void
  onCreated: (zone: ZoneWithTables) => void
}

export default function AddZoneModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[1].hex)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }

    setError(null)
    startTransition(async () => {
      const res = await addZone({ name: name.trim(), color })
      if ('error' in res) { setError(res.error); return }
      onCreated(res.zone)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-bold text-[#0f172a]">Nueva zona</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Nombre</span>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Terraza, Salón, Barra"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Color</span>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setColor(c.hex)}
                  style={{ background: c.hex }}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c.hex ? 'ring-2 ring-offset-2 ring-[#0f172a] scale-110' : 'hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Creando...' : 'Crear zona'}
          </button>
        </div>
      </div>
    </div>
  )
}
