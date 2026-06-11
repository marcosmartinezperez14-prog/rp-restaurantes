'use client'

import { useState, Fragment } from 'react'
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
  if (valor === null) return <span className="text-gray-400">—</span>
  const color = valor === 0 ? 'text-gray-500' : valor > 0 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`font-medium ${color}`}>{valor >= 0 ? '+' : ''}{fmt(valor)}</span>
}

const LIMITE = 20

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
  const [fondoInicial, setFondoInicial] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalCierre, setModalCierre] = useState(false)
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [pagina, setPagina] = useState(1)
  const [filaExpandida, setFilaExpandida] = useState<string | null>(null)
  const { offlineFetch } = useOfflineFetch()

  const efectivoEsperado = turno
    ? Number(turno.fondo_inicial) + (resumenActual?.total_efectivo ?? 0)
    : 0
  const efectivoContadoNum = parseFloat(efectivoContado) || 0
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
        payload: { fondo_inicial: parseFloat(fondoInicial) || 0 },
      })
      if (!result.ok) { setError(result.error ?? 'Error al abrir turno'); return }
      if (result.offline) { setError('Sin conexión: no se puede abrir turno offline'); return }
      const data = result.data as { turno: TurnoCaja }
      setTurno(data.turno)
      setFondoInicial('0')
    } finally {
      setLoading(false)
    }
  }

  async function handleCerrarTurno() {
    setError(null)
    setLoading(true)
    try {
      const payload: CerrarTurnoPayload = {
        efectivo_contado: parseFloat(efectivoContado) || 0,
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
      setModalCierre(false)
      setEfectivoContado('')
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

  return (
    <div className="max-w-4xl mx-auto">

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-1 w-fit">
        {(['actual', 'historial'] as const).map(v => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              vista === v ? 'bg-blue-600 text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {v === 'actual' ? 'Turno actual' : 'Historial'}
          </button>
        ))}
      </div>

      {/* ── Turno actual ── */}
      {vista === 'actual' && (
        <>
          {!turno ? (
            <div className="max-w-md mx-auto">
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-6">
                <div className="text-6xl">🏧</div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Sin turno activo</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Abre un turno para empezar a registrar ventas</p>
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Fondo inicial de caja (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={fondoInicial}
                    onChange={e => setFondoInicial(e.target.value)}
                    className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
                <button
                  onClick={handleAbrirTurno}
                  disabled={loading}
                  className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Abriendo...' : 'Abrir turno'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    Turno abierto
                  </span>
                  <p className="text-sm text-[var(--text-secondary)] pt-1">
                    Desde {fmtFecha(turno.fecha_apertura)}
                    {turno.abierto_por_nombre ? ` · ${turno.abierto_por_nombre}` : ''}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Fondo inicial:{' '}
                    <span className="font-medium text-[var(--text-primary)]">{fmt(Number(turno.fondo_inicial))}</span>
                  </p>
                </div>
                <button
                  onClick={() => { setModalCierre(true); setError(null) }}
                  className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors"
                >
                  Cerrar turno
                </button>
              </div>

              {resumenActual && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total vendido',  valor: fmt(resumenActual.total_ventas) },
                    { label: 'En efectivo',    valor: fmt(resumenActual.total_efectivo) },
                    { label: 'En tarjeta',     valor: fmt(resumenActual.total_tarjeta) },
                    { label: 'Tickets',        valor: String(resumenActual.total_tickets) },
                  ].map(({ label, valor }) => (
                    <div key={label} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4">
                      <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
                      <p className="text-lg font-bold text-[var(--text-primary)]">{valor}</p>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
            </div>
          )}
        </>
      )}

      {/* ── Historial ── */}
      {vista === 'historial' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          {historial.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Sin cierres registrados aún.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-surface-hover)]">
                  <tr>
                    {['Apertura', 'Cierre', 'Abierto por', 'Ventas', 'Efectivo', 'Tarjeta', 'Tickets', 'Descuadre', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {historial.map(t => (
                    <Fragment key={t.id}>
                      <tr className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-xs">{fmtFecha(t.fecha_apertura)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">{t.fecha_cierre ? fmtFecha(t.fecha_cierre) : '—'}</td>
                        <td className="px-4 py-3 text-xs">{t.abierto_por_nombre ?? '—'}</td>
                        <td className="px-4 py-3 font-medium">{fmt(Number(t.total_ventas ?? 0))}</td>
                        <td className="px-4 py-3">{fmt(Number(t.total_efectivo ?? 0))}</td>
                        <td className="px-4 py-3">{fmt(Number(t.total_tarjeta ?? 0))}</td>
                        <td className="px-4 py-3 text-center">{t.total_tickets ?? 0}</td>
                        <td className="px-4 py-3"><DescuadreChip valor={t.descuadre !== null ? Number(t.descuadre) : null} /></td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setFilaExpandida(prev => prev === t.id ? null : t.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                          >
                            {filaExpandida === t.id ? 'Ocultar' : 'Ver detalle'}
                          </button>
                        </td>
                      </tr>
                      {filaExpandida === t.id && (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 bg-slate-50">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Cerrado por</p>
                                <p className="font-medium">{t.cerrado_por_nombre ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Fondo inicial</p>
                                <p className="font-medium">{fmt(Number(t.fondo_inicial))}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Efectivo esperado</p>
                                <p className="font-medium">{fmt(Number(t.efectivo_esperado ?? 0))}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Efectivo contado</p>
                                <p className="font-medium">{fmt(Number(t.efectivo_contado ?? 0))}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Descuadre</p>
                                <DescuadreChip valor={t.descuadre !== null ? Number(t.descuadre) : null} />
                              </div>
                              {t.notas && (
                                <div className="col-span-2 sm:col-span-3">
                                  <p className="text-xs text-gray-500 mb-0.5">Notas</p>
                                  <p>{t.notas}</p>
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
              <button
                onClick={() => cargarHistorial(pagina - 1)}
                disabled={pagina <= 1}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg disabled:opacity-40 hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-[var(--text-secondary)]">Página {pagina} de {totalPaginas}</span>
              <button
                onClick={() => cargarHistorial(pagina + 1)}
                disabled={pagina >= totalPaginas}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg disabled:opacity-40 hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de cierre ── */}
      {modalCierre && turno && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Cierre de turno</h2>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total ventas</span>
                <span className="font-medium text-gray-900">{fmt(resumenActual?.total_ventas ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Efectivo esperado en caja</span>
                <span className="font-medium text-gray-900">{fmt(efectivoEsperado)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Efectivo contado en caja (€)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={efectivoContado}
                onChange={e => setEfectivoContado(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {efectivoContado !== '' && (
                <p className={`text-sm mt-2 font-medium ${
                  diferencia > 0 ? 'text-green-600' : diferencia < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  Diferencia: {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                value={notasCierre}
                onChange={e => setNotasCierre(e.target.value)}
                rows={2}
                placeholder="Observaciones del cierre..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setModalCierre(false); setError(null) }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCerrarTurno}
                disabled={loading || efectivoContado === ''}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
