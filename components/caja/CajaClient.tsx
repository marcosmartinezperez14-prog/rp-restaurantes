'use client'

import { useState, useEffect, Fragment } from 'react'
import type { TurnoCaja, CerrarTurnoPayload, ResumenActual } from '@/types/caja'
import { useOfflineFetch } from '@/lib/offline/useOfflineFetch'

interface Props {
  turnoActivo: TurnoCaja | null
  historial: TurnoCaja[]
  totalHistorial: number
  resumenActual: ResumenActual | null
}

function fmt(v: number) {
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function DescuadreChip({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-[var(--text-secondary)]">—</span>
  const color = valor === 0 ? 'text-[var(--text-secondary)]' : valor > 0 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`font-medium ${color}`}>{valor >= 0 ? '+' : ''}{fmt(valor)}</span>
}

function useClock() {
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  )
  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
    }, 30_000)
    return () => clearInterval(id)
  }, [])
  return clock
}

const LIMITE = 20
const PRESETS_ABRIR = ['100', '150', '200', '300']
const PRESETS_CERRAR = ['50', '100', '200', '500']

export default function CajaClient({
  turnoActivo: initialTurno,
  historial: initialHistorial,
  totalHistorial: initialTotal,
  resumenActual,
}: Props) {
  const [turno, setTurno] = useState<TurnoCaja | null>(initialTurno)
  const [historial, setHistorial] = useState<TurnoCaja[]>(initialHistorial)
  const [totalH, setTotalH] = useState(initialTotal)
  const [vista, setVista] = useState<'actual' | 'historial'>('actual')

  // abrir
  const [fondoInicial, setFondoInicial] = useState('')
  const [fondoFocused, setFondoFocused] = useState(false)
  const [presetAbrir, setPresetAbrir] = useState<string | null>(null)

  // cerrar
  const [efectivoContado, setEfectivoContado] = useState('')
  const [efectivoFocused, setEfectivoFocused] = useState(false)
  const [presetCerrar, setPresetCerrar] = useState<string | null>(null)
  const [notasCierre, setNotasCierre] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [filaExpandida, setFilaExpandida] = useState<string | null>(null)
  const { offlineFetch } = useOfflineFetch()
  const clock = useClock()

  const efectivoEsperado = turno
    ? Number(turno.fondo_inicial) + (resumenActual?.total_efectivo ?? 0)
    : 0
  const efectivoContadoNum = parseFloat(efectivoContado.replace(',', '.')) || 0
  const diferencia = efectivoContadoNum - efectivoEsperado
  const totalPaginas = Math.ceil(totalH / LIMITE)

  async function handleAbrirTurno() {
    setError(null)
    setLoading(true)
    try {
      const result = await offlineFetch({
        type: 'close_shift',
        endpoint: '/api/caja/abrir',
        method: 'POST',
        payload: { fondo_inicial: parseFloat(fondoInicial.replace(',', '.')) || 0 },
      })
      if (!result.ok) { setError(result.error ?? 'Error al abrir turno'); return }
      if (result.offline) { setError('Sin conexión: no se puede abrir turno offline'); return }
      const data = result.data as { turno: TurnoCaja }
      setTurno(data.turno)
      setFondoInicial('')
      setPresetAbrir(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleCerrarTurno() {
    setError(null)
    setLoading(true)
    try {
      const payload: CerrarTurnoPayload = {
        efectivo_contado: parseFloat(efectivoContado.replace(',', '.')) || 0,
        notas: notasCierre || undefined,
      }
      const result = await offlineFetch({
        type: 'close_shift',
        endpoint: '/api/caja/cerrar',
        method: 'POST',
        payload: payload as unknown as Record<string, unknown>,
      })
      if (!result.ok) { setError(result.error ?? 'Error al cerrar turno'); return }
      if (result.offline) { setError('Sin conexión: no se puede cerrar turno offline'); return }
      const data = result.data as { turno: TurnoCaja }
      setHistorial(prev => [data.turno, ...prev])
      setTotalH(prev => prev + 1)
      setTurno(null)
      setEfectivoContado('')
      setPresetCerrar(null)
      setNotasCierre('')
    } finally {
      setLoading(false)
    }
  }

  async function cargarHistorial(p: number) {
    try {
      const res = await fetch(`/api/caja/historial?pagina=${p}&limite=${LIMITE}`)
      if (!res.ok) return
      const data = await res.json()
      setHistorial(data.data)
      setTotalH(data.total)
      setPagina(p)
    } catch {}
  }

  const isActual = vista === 'actual'

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px 64px', background: '#f6f6f7' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, background: '#ececee', border: '1px solid #e4e4e7', borderRadius: 11, padding: 4, margin: '0 auto 26px', width: 'fit-content' }}>
          <button
            onClick={() => setVista('actual')}
            style={{
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              padding: '8px 18px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7,
              background: isActual ? '#fff' : 'transparent',
              color: isActual ? '#1b1e24' : '#82858d',
              boxShadow: isActual ? '0 1px 2px rgba(20,23,29,0.08)' : 'none',
              transition: 'all .15s ease',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActual ? 'var(--accent)' : '#c2c4c9' }} />
            Turno actual
          </button>
          <button
            onClick={() => setVista('historial')}
            style={{
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              padding: '8px 18px', borderRadius: 8,
              background: !isActual ? '#fff' : 'transparent',
              color: !isActual ? '#1b1e24' : '#82858d',
              boxShadow: !isActual ? '0 1px 2px rgba(20,23,29,0.08)' : 'none',
              transition: 'all .15s ease',
            }}
          >
            Historial
          </button>
        </div>

        {/* ── Turno actual ── */}
        {vista === 'actual' && (
          <>
            {!turno ? (
              /* ── ABRIR TURNO ── */
              <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 18, padding: '34px 32px 32px', boxShadow: '0 1px 2px rgba(20,23,29,0.04), 0 12px 34px rgba(20,23,29,0.05)' }}>

                {/* status chip */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f4f4f5', border: '1px solid #e9e9eb', borderRadius: 999, padding: '5px 12px 5px 10px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c0872b', boxShadow: '0 0 0 3px rgba(192,135,43,0.16)' }} />
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', color: '#71757c' }}>CAJA CERRADA</span>
                  </div>
                </div>

                {/* icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, background: '#f3f3f5', border: '1px solid #ececee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#33363d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="13" rx="2.5"/>
                      <path d="M2 10.5h20"/>
                      <circle cx="12" cy="14.5" r="2"/>
                      <path d="M5.5 14.5h1.5M17 14.5h1.5"/>
                    </svg>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 26 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', color: '#1b1e24' }}>Sin turno activo</div>
                  <div style={{ fontSize: 13, color: '#84878e', marginTop: 5, lineHeight: 1.5 }}>Abre un turno para empezar a registrar ventas</div>
                </div>

                {/* input fondo */}
                <label style={{ display: 'block', marginBottom: 9 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4d5159', letterSpacing: '0.1px' }}>Fondo inicial de caja</span>
                </label>
                <div style={{
                  position: 'relative', display: 'flex', alignItems: 'center',
                  border: `1.5px solid ${fondoFocused ? 'var(--accent)' : '#e6e6e8'}`,
                  background: '#fcfcfd', borderRadius: 11, padding: '0 14px', height: 52,
                  transition: 'border-color .15s ease, box-shadow .15s ease',
                  boxShadow: fondoFocused ? '0 0 0 4px rgba(var(--accent-rgb, 31,93,76),0.10)' : 'none',
                }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, fontWeight: 600, color: '#b6b8bd', marginRight: 8 }}>€</span>
                  <input
                    value={fondoInicial}
                    onChange={e => { setFondoInicial(e.target.value); setPresetAbrir(null) }}
                    onFocus={() => setFondoFocused(true)}
                    onBlur={() => setFondoFocused(false)}
                    inputMode="decimal"
                    placeholder="0,00"
                    style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'ui-monospace, monospace', fontSize: 19, fontWeight: 600, color: '#1b1e24', padding: 0, outline: 'none', width: '100%' }}
                  />
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#b6b8bd', letterSpacing: '0.3px' }}>EUR</span>
                </div>

                {/* presets */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {PRESETS_ABRIR.map(v => {
                    const on = presetAbrir === v
                    return (
                      <button
                        key={v}
                        onClick={() => { setPresetAbrir(v); setFondoInicial(v) }}
                        style={{
                          flex: 1, cursor: 'pointer', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, fontWeight: 500,
                          padding: '9px 0', borderRadius: 9,
                          border: `1px solid ${on ? 'var(--accent)' : '#e8e8ea'}`,
                          background: on ? 'rgba(31,93,76,0.08)' : '#fff',
                          color: on ? 'var(--accent)' : '#6b6f77',
                          transition: 'all .14s ease',
                        }}
                      >
                        €{v}
                      </button>
                    )
                  })}
                </div>

                {error && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
                    {error}
                  </div>
                )}

                {/* button */}
                <button
                  onClick={handleAbrirTurno}
                  disabled={loading}
                  style={{
                    marginTop: 22, width: '100%', height: 52, border: 'none', cursor: loading ? 'default' : 'pointer',
                    borderRadius: 12, background: 'var(--accent)', color: '#fff', fontFamily: 'inherit',
                    fontSize: 14.5, fontWeight: 700, letterSpacing: '0.1px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    opacity: loading ? 0.7 : 1, transition: 'opacity .15s ease',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/>
                  </svg>
                  {loading ? 'Abriendo...' : 'Abrir turno'}
                </button>

                {/* footer meta */}
                <FooterMeta clock={clock} nombre={null} />
              </div>
            ) : (
              /* ── CERRAR TURNO ── */
              <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 18, padding: '34px 32px 32px', boxShadow: '0 1px 2px rgba(20,23,29,0.04), 0 12px 34px rgba(20,23,29,0.05)' }}>

                {/* status chip */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '5px 12px 5px 10px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 3px rgba(22,163,74,0.16)' }} />
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', color: '#15803d' }}>TURNO ABIERTO</span>
                  </div>
                </div>

                {/* icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6h13M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
                    </svg>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', color: '#1b1e24' }}>Turno en curso</div>
                  <div style={{ fontSize: 13, color: '#84878e', marginTop: 5, lineHeight: 1.5 }}>
                    Desde {fmtFecha(turno.fecha_apertura)}
                    {turno.abierto_por_nombre ? ` · ${turno.abierto_por_nombre}` : ''}
                  </div>
                </div>

                {/* stats */}
                {resumenActual && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 22 }}>
                    {[
                      { label: 'Total ventas', valor: fmt(resumenActual.total_ventas) },
                      { label: 'En efectivo', valor: fmt(resumenActual.total_efectivo) },
                      { label: 'En tarjeta', valor: fmt(resumenActual.total_tarjeta) },
                      { label: 'Tickets', valor: String(resumenActual.total_tickets) },
                    ].map(({ label, valor }) => (
                      <div key={label} style={{ background: '#f8f8f9', border: '1px solid #ececee', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#84878e', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, fontWeight: 600, color: '#1b1e24' }}>{valor}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* resumen efectivo esperado */}
                <div style={{ background: '#f8f8f9', border: '1px solid #ececee', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#84878e' }}>Efectivo esperado en caja</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#1b1e24' }}>{fmt(efectivoEsperado)}</span>
                  </div>
                </div>

                {/* input efectivo contado */}
                <label style={{ display: 'block', marginBottom: 9 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4d5159', letterSpacing: '0.1px' }}>Efectivo contado en caja</span>
                </label>
                <div style={{
                  position: 'relative', display: 'flex', alignItems: 'center',
                  border: `1.5px solid ${efectivoFocused ? '#dc2626' : '#e6e6e8'}`,
                  background: '#fcfcfd', borderRadius: 11, padding: '0 14px', height: 52,
                  transition: 'border-color .15s ease, box-shadow .15s ease',
                  boxShadow: efectivoFocused ? '0 0 0 4px rgba(220,38,38,0.10)' : 'none',
                }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, fontWeight: 600, color: '#b6b8bd', marginRight: 8 }}>€</span>
                  <input
                    value={efectivoContado}
                    onChange={e => { setEfectivoContado(e.target.value); setPresetCerrar(null) }}
                    onFocus={() => setEfectivoFocused(true)}
                    onBlur={() => setEfectivoFocused(false)}
                    inputMode="decimal"
                    placeholder="0,00"
                    autoFocus
                    style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'ui-monospace, monospace', fontSize: 19, fontWeight: 600, color: '#1b1e24', padding: 0, outline: 'none', width: '100%' }}
                  />
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#b6b8bd', letterSpacing: '0.3px' }}>EUR</span>
                </div>

                {/* presets */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {PRESETS_CERRAR.map(v => {
                    const on = presetCerrar === v
                    return (
                      <button
                        key={v}
                        onClick={() => { setPresetCerrar(v); setEfectivoContado(v) }}
                        style={{
                          flex: 1, cursor: 'pointer', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, fontWeight: 500,
                          padding: '9px 0', borderRadius: 9,
                          border: `1px solid ${on ? '#dc2626' : '#e8e8ea'}`,
                          background: on ? 'rgba(220,38,38,0.07)' : '#fff',
                          color: on ? '#dc2626' : '#6b6f77',
                          transition: 'all .14s ease',
                        }}
                      >
                        €{v}
                      </button>
                    )
                  })}
                </div>

                {/* diferencia */}
                {efectivoContado !== '' && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: diferencia === 0 ? '#f8f8f9' : diferencia > 0 ? '#fefce8' : '#fef2f2', border: `1px solid ${diferencia === 0 ? '#ececee' : diferencia > 0 ? '#fde68a' : '#fecaca'}`, borderRadius: 10 }}>
                    <span style={{ fontSize: 13, color: '#84878e' }}>Diferencia</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 700, color: diferencia === 0 ? '#84878e' : diferencia > 0 ? '#ca8a04' : '#dc2626' }}>
                      {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                    </span>
                  </div>
                )}

                {/* notas */}
                <div style={{ marginTop: 14 }}>
                  <label style={{ display: 'block', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#4d5159', letterSpacing: '0.1px' }}>Notas (opcional)</span>
                  </label>
                  <textarea
                    value={notasCierre}
                    onChange={e => setNotasCierre(e.target.value)}
                    rows={2}
                    placeholder="Observaciones del cierre..."
                    style={{ width: '100%', border: '1.5px solid #e6e6e8', borderRadius: 11, padding: '10px 14px', fontSize: 13, color: '#1b1e24', background: '#fcfcfd', outline: 'none', resize: 'none', fontFamily: 'inherit', transition: 'border-color .15s ease', boxSizing: 'border-box' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e6e6e8'}
                  />
                </div>

                {error && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
                    {error}
                  </div>
                )}

                {/* button */}
                <button
                  onClick={handleCerrarTurno}
                  disabled={loading || efectivoContado === ''}
                  style={{
                    marginTop: 22, width: '100%', height: 52, border: 'none',
                    cursor: loading || efectivoContado === '' ? 'default' : 'pointer',
                    borderRadius: 12, background: '#dc2626', color: '#fff', fontFamily: 'inherit',
                    fontSize: 14.5, fontWeight: 700, letterSpacing: '0.1px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    opacity: loading || efectivoContado === '' ? 0.5 : 1, transition: 'opacity .15s ease',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                  {loading ? 'Cerrando...' : 'Cerrar turno'}
                </button>

                {/* footer meta */}
                <FooterMeta clock={clock} nombre={turno.abierto_por_nombre ?? null} />
              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#a7a9af', marginTop: 16, lineHeight: 1.5 }}>
              {!turno
                ? 'El fondo inicial se descontará del arqueo al cerrar el turno.'
                : `Fondo inicial: ${fmt(Number(turno.fondo_inicial))}`
              }
            </p>
          </>
        )}

        {/* ── Historial ── */}
        {vista === 'historial' && (
          <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,23,29,0.04), 0 12px 34px rgba(20,23,29,0.05)' }}>
            {historial.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: '#84878e' }}>Sin cierres registrados aún.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8f8f9' }}>
                    <tr>
                      {['Apertura', 'Cierre', 'Abierto por', 'Ventas', 'Efectivo', 'Tarjeta', 'Tickets', 'Descuadre', ''].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#84878e', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', borderBottom: '1px solid #ececee' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map(t => (
                      <Fragment key={t.id}>
                        <tr style={{ borderBottom: '1px solid #f0f0f1' }} onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtFecha(t.fecha_apertura)}</td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: 12 }}>{t.fecha_cierre ? fmtFecha(t.fecha_cierre) : '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12 }}>{t.abierto_por_nombre ?? '—'}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{fmt(Number(t.total_ventas ?? 0))}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace' }}>{fmt(Number(t.total_efectivo ?? 0))}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace' }}>{fmt(Number(t.total_tarjeta ?? 0))}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.total_tickets ?? 0}</td>
                          <td style={{ padding: '12px 16px' }}><DescuadreChip valor={t.descuadre !== null ? Number(t.descuadre) : null} /></td>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              onClick={() => setFilaExpandida(prev => prev === t.id ? null : t.id)}
                              style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              {filaExpandida === t.id ? 'Ocultar' : 'Ver detalle'}
                            </button>
                          </td>
                        </tr>
                        {filaExpandida === t.id && (
                          <tr>
                            <td colSpan={9} style={{ padding: '16px 20px', background: '#f8f8f9', borderBottom: '1px solid #ececee' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
                                <div>
                                  <div style={{ fontSize: 11, color: '#84878e', marginBottom: 2 }}>Cerrado por</div>
                                  <div style={{ fontWeight: 500 }}>{t.cerrado_por_nombre ?? '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: '#84878e', marginBottom: 2 }}>Fondo inicial</div>
                                  <div style={{ fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>{fmt(Number(t.fondo_inicial))}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: '#84878e', marginBottom: 2 }}>Efectivo esperado</div>
                                  <div style={{ fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>{fmt(Number(t.efectivo_esperado ?? 0))}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: '#84878e', marginBottom: 2 }}>Efectivo contado</div>
                                  <div style={{ fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>{fmt(Number(t.efectivo_contado ?? 0))}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: '#84878e', marginBottom: 2 }}>Descuadre</div>
                                  <DescuadreChip valor={t.descuadre !== null ? Number(t.descuadre) : null} />
                                </div>
                                {t.notas && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: 11, color: '#84878e', marginBottom: 2 }}>Notas</div>
                                    <div>{t.notas}</div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #ececee' }}>
                <button
                  onClick={() => cargarHistorial(pagina - 1)}
                  disabled={pagina <= 1}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, border: '1px solid #e6e6e8', borderRadius: 8, background: '#fff', cursor: pagina <= 1 ? 'default' : 'pointer', opacity: pagina <= 1 ? 0.4 : 1 }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: 12, color: '#84878e' }}>Página {pagina} de {totalPaginas}</span>
                <button
                  onClick={() => cargarHistorial(pagina + 1)}
                  disabled={pagina >= totalPaginas}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, border: '1px solid #e6e6e8', borderRadius: 8, background: '#fff', cursor: pagina >= totalPaginas ? 'default' : 'pointer', opacity: pagina >= totalPaginas ? 0.4 : 1 }}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FooterMeta({ clock, nombre }: { clock: string; nombre: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20, paddingTop: 18, borderTop: '1px solid #f0f0f1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a7a9af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#9a9da3' }}>{clock}</span>
      </div>
      {nombre && (
        <>
          <span style={{ width: 1, height: 12, background: '#e7e7e9' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a7a9af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20a6 6 0 0 1 12 0"/><circle cx="9" cy="8" r="3.5"/>
            </svg>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#9a9da3' }}>{nombre}</span>
          </div>
        </>
      )}
    </div>
  )
}
