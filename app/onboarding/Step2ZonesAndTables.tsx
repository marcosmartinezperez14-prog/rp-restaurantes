'use client'

import { useState, useTransition } from 'react'
import { saveZonesAndTables, type ZoneInput } from '@/app/actions/onboarding'

interface Props {
  zones: ZoneInput[]
  onNext: (zones: ZoneInput[]) => void
}

export default function Step2ZonesAndTables({ zones: initialZones, onNext }: Props) {
  const [zones, setZones] = useState<ZoneInput[]>(initialZones)
  const [editingZoneIdx, setEditingZoneIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const addZone = () => {
    setZones(z => [...z, { name: 'Nueva zona', tables: [{ name: 'Mesa 1' }] }])
  }

  const removeZone = (idx: number) => {
    if (zones.length <= 1) return
    setZones(z => z.filter((_, i) => i !== idx))
  }

  const updateZoneName = (idx: number, name: string) => {
    setZones(z => z.map((zone, i) => (i === idx ? { ...zone, name } : zone)))
  }

  const addTable = (zoneIdx: number) => {
    setZones(z =>
      z.map((zone, i) => {
        if (i !== zoneIdx) return zone
        const nextNum = zone.tables.length + 1
        return { ...zone, tables: [...zone.tables, { name: `Mesa ${nextNum}` }] }
      })
    )
  }

  const removeTable = (zoneIdx: number, tableIdx: number) => {
    setZones(z =>
      z.map((zone, i) => {
        if (i !== zoneIdx) return zone
        if (zone.tables.length <= 1) return zone
        return { ...zone, tables: zone.tables.filter((_, ti) => ti !== tableIdx) }
      })
    )
  }

  const updateTableName = (zoneIdx: number, tableIdx: number, name: string) => {
    setZones(z =>
      z.map((zone, i) => {
        if (i !== zoneIdx) return zone
        return {
          ...zone,
          tables: zone.tables.map((t, ti) => (ti === tableIdx ? { ...t, name } : t)),
        }
      })
    )
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveZonesAndTables(zones)
      if (result?.error) {
        setError(result.error)
      } else {
        onNext(zones)
      }
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Zonas y mesas</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Revisa y personaliza las zonas y mesas de tu restaurante.
      </p>

      {zones.map((zone, zoneIdx) => (
        <div key={zoneIdx} className="border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            {editingZoneIdx === zoneIdx ? (
              <input
                autoFocus
                value={zone.name}
                onChange={e => updateZoneName(zoneIdx, e.target.value)}
                onBlur={() => setEditingZoneIdx(null)}
                className="flex-1 border border-blue-400 rounded px-2 py-1 text-[var(--text-primary)] text-sm focus:outline-none"
              />
            ) : (
              <span className="font-medium text-[var(--text-primary)] flex-1">{zone.name}</span>
            )}
            <button
              type="button"
              onClick={() => setEditingZoneIdx(zoneIdx)}
              className="text-[var(--text-secondary)] hover:text-blue-600 px-2 text-sm"
              title="Renombrar zona"
            >
              ✎
            </button>
            {zones.length > 1 && (
              <button
                type="button"
                onClick={() => removeZone(zoneIdx)}
                className="text-[var(--text-secondary)] hover:text-red-500 px-2 text-sm"
                title="Eliminar zona"
              >
                🗑
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {zone.tables.map((table, tableIdx) => (
              <div
                key={tableIdx}
                className="flex items-center gap-1 bg-[var(--bg-page)] rounded-full px-3 py-1 text-sm text-gray-800"
              >
                <input
                  value={table.name}
                  onChange={e => updateTableName(zoneIdx, tableIdx, e.target.value)}
                  className="bg-transparent outline-none w-20 text-sm"
                />
                {zone.tables.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTable(zoneIdx, tableIdx)}
                    className="text-[var(--text-secondary)] hover:text-red-500 ml-1 leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addTable(zoneIdx)}
              className="bg-blue-50 text-blue-600 rounded-full px-3 py-1 text-sm hover:bg-blue-100"
            >
              + mesa
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addZone}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-[var(--text-secondary)] hover:border-blue-400 hover:text-blue-600 text-sm transition-colors"
      >
        + Añadir zona
      </button>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Guardando...' : 'Guardar y continuar →'}
      </button>
    </div>
  )
}
