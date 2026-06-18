'use client'

import { useState, useTransition } from 'react'
import type { ZoneWithTables, TableWithOrder } from '@/app/actions/tpv'
import { addTable } from '@/app/actions/tpv'

interface Props {
  zones: ZoneWithTables[]
  defaultZoneId?: string
  onClose: () => void
  onCreated: (zoneId: string, table: TableWithOrder) => void
}

export default function AddTableModal({ zones, defaultZoneId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('4')
  const [zoneId, setZoneId] = useState(defaultZoneId ?? zones[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const cap = parseInt(capacity)
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (isNaN(cap) || cap < 1) { setError('La capacidad debe ser al menos 1'); return }
    if (!zoneId) { setError('Selecciona una zona'); return }

    setError(null)
    startTransition(async () => {
      const res = await addTable({ name: name.trim(), capacity: cap, zoneId })
      if ('error' in res) { setError(res.error); return }
      onCreated(zoneId, res.table)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-[var(--text-primary)]">Nueva mesa</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Zona</span>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400 bg-[var(--bg-surface)]">
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Nombre</span>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Mesa 5, Barra 1"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Capacidad (personas)</span>
            <input value={capacity} onChange={e => setCapacity(e.target.value)}
              type="number" min="1"
              className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400" />
          </label>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)]">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50">
            {isPending ? 'Creando...' : 'Crear mesa'}
          </button>
        </div>
      </div>
    </div>
  )
}
