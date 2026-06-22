'use client'

import { useState, useEffect } from 'react'
import { FichajeHistorial } from '@/types/fichajes'

interface Props {
  isAdmin: boolean
  refreshKey?: number
}

function toYMD(d: Date): string { return d.toISOString().slice(0, 10) }

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function formatDuracion(mins: number | null): string {
  if (mins === null) return '— en curso'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h === 0 ? `${m} min` : `${h} h ${m} min`
}

function exportarCSV(data: FichajeHistorial[], isAdmin: boolean) {
  const headers = [...(isAdmin ? ['Empleado'] : []), 'Fecha', 'Entrada', 'Salida', 'Duración', 'Nota']
  const rows = data.map(f => [
    ...(isAdmin ? [f.nombre] : []),
    formatFecha(f.entrada_at),
    formatHora(f.entrada_at),
    f.salida_at ? formatHora(f.salida_at) : '',
    formatDuracion(f.duracion_min),
    f.nota ?? '',
  ])
  const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fichajes-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function getUniqueUsers(fichajes: FichajeHistorial[]): { user_id: string; nombre: string }[] {
  const map = new Map<string, string>()
  for (const f of fichajes) { if (!map.has(f.user_id)) map.set(f.user_id, f.nombre) }
  return Array.from(map.entries()).map(([user_id, nombre]) => ({ user_id, nombre }))
}

const inputFieldStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9,
  border: '1.5px solid #e6e6e8', background: '#fcfcfd',
  borderRadius: 10, padding: '0 12px', height: 44, marginTop: 7,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: '#6b6f77',
}

export default function HistorialFichajes({ isAdmin, refreshKey }: Props) {
  const [fichajes, setFichajes] = useState<FichajeHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return toYMD(d) })
  const [hasta, setHasta] = useState(() => toYMD(new Date()))
  const [filtroUserId, setFiltroUserId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ desde, hasta: `${hasta}T23:59:59.000Z` })
        if (filtroUserId) params.set('user_id', filtroUserId)
        const res = await fetch(`/api/fichajes/historial?${params.toString()}`)
        if (!res.ok) return
        const json = await res.json() as { data: FichajeHistorial[] }
        if (!cancelled) setFichajes(json.data)
      } catch {
        // leave previous data
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchData()
    return () => { cancelled = true }
  }, [desde, hasta, filtroUserId, refreshKey])

  const usuarios = getUniqueUsers(fichajes)
  const colCount = isAdmin ? 5 : 4

  return (
    <>
      {/* ── Filters card ── */}
      <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, padding: 20, boxShadow: '0 1px 2px rgba(20,23,29,0.04)', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c7f86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16M7 12h10M10 19h4"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: '#4d5159' }}>Filtrar registros</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Desde</span>
            <div style={inputFieldStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a7a9af" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/>
              </svg>
              <input
                type="date"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'ui-monospace, monospace', fontSize: 13.5, fontWeight: 500, color: '#2c2f36', outline: 'none', width: '100%' }}
              />
            </div>
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Hasta</span>
            <div style={inputFieldStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a7a9af" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/>
              </svg>
              <input
                type="date"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'ui-monospace, monospace', fontSize: 13.5, fontWeight: 500, color: '#2c2f36', outline: 'none', width: '100%' }}
              />
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          {isAdmin && (
            <label style={{ display: 'block', flex: 1 }}>
              <span style={labelStyle}>Empleado</span>
              <div style={{ position: 'relative', marginTop: 7 }}>
                <select
                  value={filtroUserId}
                  onChange={e => setFiltroUserId(e.target.value)}
                  style={{
                    appearance: 'none', width: '100%', border: '1.5px solid #e6e6e8', background: '#fcfcfd',
                    borderRadius: 10, padding: '0 36px 0 12px', height: 44,
                    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, color: '#2c2f36', cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="">Todos los empleados</option>
                  {usuarios.map(u => <option key={u.user_id} value={u.user_id}>{u.nombre}</option>)}
                </select>
                <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a7a9af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </label>
          )}
          <button
            onClick={() => exportarCSV(fichajes, isAdmin)}
            disabled={loading || fichajes.length === 0}
            style={{
              height: 44, cursor: loading || fichajes.length === 0 ? 'default' : 'pointer',
              border: '1.5px solid #e6e6e8', background: '#fff', borderRadius: 10,
              padding: '0 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#4d5159',
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: loading || fichajes.length === 0 ? 0.4 : 1,
              transition: 'border-color .14s ease, color .14s ease',
              marginTop: isAdmin ? 'auto' : 0,
              alignSelf: 'flex-end',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Table card ── */}
      <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,23,29,0.04)' }}>
        {/* table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isAdmin ? '1.4fr 1fr 0.9fr 0.9fr 0.9fr' : '1fr 0.9fr 0.9fr 0.9fr',
          gap: 8, padding: '13px 20px', background: '#fafafa', borderBottom: '1px solid #eeeeef',
        }}>
          {isAdmin && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#9a9da3' }}>Empleado</span>}
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#9a9da3' }}>Fecha</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#9a9da3' }}>Entrada</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#9a9da3' }}>Salida</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#9a9da3', textAlign: 'right' }}>Duración</span>
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{
                width: '100%', height: 18, background: '#f0f0f1', borderRadius: 6, marginBottom: 12,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : fichajes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#f5f5f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c2c4c9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3 1.7"/>
              </svg>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#6b6f77' }}>No hay registros para el período seleccionado</div>
            <div style={{ fontSize: 12.5, color: '#a7a9af', marginTop: 4 }}>Ficha tu entrada o ajusta los filtros para ver resultados.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {fichajes.map((f, idx) => (
              <div
                key={f.fichaje_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isAdmin ? '1.4fr 1fr 0.9fr 0.9fr 0.9fr' : '1fr 0.9fr 0.9fr 0.9fr',
                  gap: 8, padding: '13px 20px',
                  borderBottom: idx < fichajes.length - 1 ? '1px solid #f2f2f3' : 'none',
                  background: idx % 2 === 0 ? '#fff' : '#fafafa',
                }}
              >
                {isAdmin && (
                  <span style={{ fontSize: 13, color: '#1b1e24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</span>
                )}
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#1b1e24', whiteSpace: 'nowrap' }}>{formatFecha(f.entrada_at)}</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#1b1e24', whiteSpace: 'nowrap' }}>{formatHora(f.entrada_at)}</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: f.salida_at ? '#1b1e24' : '#a7a9af', whiteSpace: 'nowrap' }}>
                  {f.salida_at ? formatHora(f.salida_at) : '—'}
                </span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#1b1e24', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {formatDuracion(f.duracion_min)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
