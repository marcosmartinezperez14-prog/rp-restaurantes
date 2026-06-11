'use client'

import { useState, useEffect } from 'react'
import { FichajeHistorial } from '@/types/fichajes'

interface Props {
  isAdmin: boolean
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuracion(mins: number | null): string {
  if (mins === null) return '— en curso'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  return `${h} h ${m} min`
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportarCSV(data: FichajeHistorial[], isAdmin: boolean) {
  const headers = [
    ...(isAdmin ? ['Empleado'] : []),
    'Fecha',
    'Entrada',
    'Salida',
    'Duración',
    'Nota',
  ]
  const rows = data.map((f) => [
    ...(isAdmin ? [f.nombre] : []),
    formatFecha(f.entrada_at),
    formatHora(f.entrada_at),
    f.salida_at ? formatHora(f.salida_at) : '',
    formatDuracion(f.duracion_min),
    f.nota ?? '',
  ])
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fichajes-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDefaultDesde(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return toYMD(d)
}

function getDefaultHasta(): string {
  return toYMD(new Date())
}

function getUniqueUsers(
  fichajes: FichajeHistorial[]
): { user_id: string; nombre: string }[] {
  const map = new Map<string, string>()
  for (const f of fichajes) {
    if (!map.has(f.user_id)) map.set(f.user_id, f.nombre)
  }
  return Array.from(map.entries()).map(([user_id, nombre]) => ({
    user_id,
    nombre,
  }))
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HistorialFichajes({ isAdmin }: Props) {
  const [fichajes, setFichajes] = useState<FichajeHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState<string>(getDefaultDesde)
  const [hasta, setHasta] = useState<string>(getDefaultHasta)
  const [filtroUserId, setFiltroUserId] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          desde,
          hasta: `${hasta}T23:59:59.000Z`,
        })
        if (filtroUserId) params.set('user_id', filtroUserId)

        const res = await fetch(`/api/fichajes/historial?${params.toString()}`)
        if (!res.ok) return

        const json = (await res.json()) as { data: FichajeHistorial[] }
        if (!cancelled) setFichajes(json.data)
      } catch {
        // Network error — leave previous data in place
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchData()
    return () => {
      cancelled = true
    }
  }, [desde, hasta, filtroUserId])

  const usuarios = getUniqueUsers(fichajes)

  const inputClass =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white'
  const inputStyle = { color: 'black' }

  return (
    <div className="w-full px-4 py-6 space-y-4 max-w-full">
      {/* Filters card */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Desde */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-500">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Hasta */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-500">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* User filter — admin only */}
          {isAdmin && (
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs font-medium text-gray-500">
                Empleado
              </label>
              <select
                value={filtroUserId}
                onChange={(e) => setFiltroUserId(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Todos los empleados</option>
                {usuarios.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export button */}
          <div className="flex flex-col justify-end">
            <button
              onClick={() => exportarCSV(fichajes, isAdmin)}
              disabled={loading || fichajes.length === 0}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {isAdmin && (
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                    Empleado
                  </th>
                )}
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  Fecha
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  Entrada
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  Salida
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  Duración
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  Nota
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : fichajes.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    No hay registros para el período seleccionado.
                  </td>
                </tr>
              ) : (
                fichajes.map((f, idx) => (
                  <tr
                    key={f.fichaje_id}
                    className={
                      idx % 2 === 0
                        ? 'bg-white'
                        : 'bg-gray-50'
                    }
                  >
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {f.nombre}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatFecha(f.entrada_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatHora(f.entrada_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {f.salida_at ? formatHora(f.salida_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatDuracion(f.duracion_min)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {f.nota ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
