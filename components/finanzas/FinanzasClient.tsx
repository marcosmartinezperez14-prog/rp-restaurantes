'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import type { Movimiento, MovimientoTipo, Recurrencia } from '@/types/finanzas'
import type { TicketResumen } from '@/types/ticket'
import TicketPreview from '@/components/tpv/TicketPreview'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const CATEGORIAS: Record<MovimientoTipo, string[]> = {
  ingreso: ['Ventas', 'Servicios', 'Otros ingresos'],
  gasto: ['Alimentación', 'Bebidas', 'Limpieza', 'Equipamiento', 'Suministros', 'Personal', 'Alquiler', 'Servicios', 'Otros'],
}

const RECURRENCIAS: { value: Recurrencia; label: string; desc: string }[] = [
  { value: 'unico',   label: 'Único',   desc: 'Solo ocurre una vez en la fecha indicada' },
  { value: 'mensual', label: 'Mensual', desc: 'Se repite cada mes en el mismo día' },
  { value: 'anual',   label: 'Anual',   desc: 'Se repite cada año en la misma fecha' },
]

const METODO_LABEL: Record<string, string> = {
  cash:  'Efectivo',
  card:  'Tarjeta',
  bizum: 'Bizum',
  mixed: 'Mixto',
}

type Periodo = 'este_mes' | 'mes_anterior' | 'ultimos_3_meses' | 'este_ano' | 'todo'
type Tab = 'movimientos' | 'tickets'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'este_mes',        label: 'Este mes' },
  { value: 'mes_anterior',    label: 'Mes anterior' },
  { value: 'ultimos_3_meses', label: 'Últimos 3 meses' },
  { value: 'este_ano',        label: 'Este año' },
  { value: 'todo',            label: 'Todo' },
]

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

function fmt(valor: number): string {
  return valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function getPeriodoRange(periodo: Periodo): { desde: Date; hasta: Date } {
  const now = new Date()
  const mes = now.getMonth()
  const año = now.getFullYear()

  switch (periodo) {
    case 'este_mes':
      return { desde: new Date(año, mes, 1), hasta: new Date(año, mes + 1, 0, 23, 59, 59) }
    case 'mes_anterior':
      return { desde: new Date(año, mes - 1, 1), hasta: new Date(año, mes, 0, 23, 59, 59) }
    case 'ultimos_3_meses':
      return { desde: new Date(año, mes - 2, 1), hasta: new Date(año, mes + 1, 0, 23, 59, 59) }
    case 'este_ano':
      return { desde: new Date(año, 0, 1), hasta: new Date(año, 11, 31, 23, 59, 59) }
    default:
      return { desde: new Date(0), hasta: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
  }
}

function calcularImporteEnRango(m: Movimiento, desde: Date, hasta: Date): number {
  const importe = Number(m.importe)
  const inicio = new Date(m.fecha + 'T00:00:00')

  if (m.recurrencia === 'unico') {
    return inicio >= desde && inicio <= hasta ? importe : 0
  }

  if (inicio > hasta) return 0

  if (m.recurrencia === 'mensual') {
    const d = new Date(inicio)
    while (d < desde) d.setMonth(d.getMonth() + 1)
    let count = 0
    while (d <= hasta) { count++; d.setMonth(d.getMonth() + 1) }
    return count * importe
  }

  if (m.recurrencia === 'anual') {
    const d = new Date(inicio)
    while (d < desde) d.setFullYear(d.getFullYear() + 1)
    let count = 0
    while (d <= hasta) { count++; d.setFullYear(d.getFullYear() + 1) }
    return count * importe
  }

  return 0
}

function getDatosGrafico(movimientos: Movimiento[]) {
  const now = new Date()
  const datos = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      periodo: MESES[d.getMonth()],
      desde: new Date(d.getFullYear(), d.getMonth(), 1),
      hasta: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      Ingresos: 0,
      Gastos: 0,
    }
  })

  for (const m of movimientos) {
    for (const slot of datos) {
      const imp = calcularImporteEnRango(m, slot.desde, slot.hasta)
      if (m.tipo === 'ingreso') slot.Ingresos += imp
      else slot.Gastos += imp
    }
  }

  return datos.map(({ periodo, Ingresos, Gastos }) => ({
    periodo,
    Ingresos: Math.round(Ingresos * 100) / 100,
    Gastos: Math.round(Gastos * 100) / 100,
  }))
}

function etiquetaRecurrencia(m: Movimiento): string | null {
  if (m.recurrencia === 'unico') return null
  const d = new Date(m.fecha + 'T00:00:00')
  if (m.recurrencia === 'mensual') return `Mensual · día ${d.getDate()}`
  if (m.recurrencia === 'anual')   return `Anual · ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`
  return null
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  movimientos: Movimiento[]
  ingresos_tpv: number
  num_tickets: number
  restaurantId: string
  tickets: TicketResumen[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FinanzasClient({ movimientos: inicial, ingresos_tpv, num_tickets, restaurantId, tickets }: Props) {
  const [movimientos, setMovimientos] = useState(inicial)
  const [periodo, setPeriodo] = useState<Periodo>('este_mes')
  const [tab, setTab] = useState<Tab>('movimientos')
  const [modalTipo, setModalTipo] = useState<MovimientoTipo | null>(null)
  const [ticketModalId, setTicketModalId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [enviandoIds, setEnviandoIds] = useState<Set<string>>(new Set())
  const [vfResults, setVfResults] = useState<Record<string, { status: string; url: string | null }>>({})
  const [editModal, setEditModal] = useState<{ ticketId: string; numero: string; total: number } | null>(null)
  const [batchConfirm, setBatchConfirm] = useState(false)
  const [anularModal, setAnularModal] = useState<{ ticketId: string; numero: string; total: number; fecha: string; yaEnviado: boolean } | null>(null)
  const [anulandoId, setAnulandoId] = useState<string | null>(null)
  const [anuladoLocal, setAnuladoLocal] = useState<Set<string>>(new Set())

  const { desde, hasta } = useMemo(() => getPeriodoRange(periodo), [periodo])

  const ingresos_manuales = useMemo(
    () => movimientos.filter(m => m.tipo === 'ingreso')
      .reduce((s, m) => s + calcularImporteEnRango(m, desde, hasta), 0),
    [movimientos, desde, hasta],
  )
  const gastos_total = useMemo(
    () => movimientos.filter(m => m.tipo === 'gasto')
      .reduce((s, m) => s + calcularImporteEnRango(m, desde, hasta), 0),
    [movimientos, desde, hasta],
  )
  const beneficio_neto = ingresos_tpv + ingresos_manuales - gastos_total

  const datosGrafico = useMemo(() => getDatosGrafico(movimientos), [movimientos])

  const ticketsFiltrados = useMemo(() => {
    return tickets.filter(t => {
      const fecha = new Date(t.fecha)
      return fecha >= desde && fecha <= hasta
    })
  }, [tickets, desde, hasta])

  const ticketsPendientes = useMemo(() =>
    ticketsFiltrados.filter(t => {
      const s = vfResults[t.id]?.status ?? t.verifactu_status
      return !s
    }), [ticketsFiltrados, vfResults])

  const ticketsEnviados = useMemo(() =>
    ticketsFiltrados
      .filter(t => {
        const s = vfResults[t.id]?.status ?? t.verifactu_status
        return !!s
      })
      .map(t => ({
        ...t,
        verifactu_status: vfResults[t.id]?.status ?? t.verifactu_status,
        verifactu_url: vfResults[t.id]?.url ?? t.verifactu_url,
      })), [ticketsFiltrados, vfResults])

  const enviarTicket = useCallback(async (
    ticketId: string,
    tipoFactura: 'F1' | 'F2',
    clienteNif?: string,
    clienteNombre?: string,
  ) => {
    setEnviandoIds(prev => new Set([...prev, ticketId]))
    try {
      const res = await fetch('/api/verifactu/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, tipoFactura, clienteNif, clienteNombre }),
      })
      const data = await res.json() as { ok?: boolean; data?: { estado: string; url?: string }; error?: string }
      if (res.ok && data.ok && data.data) {
        setVfResults(prev => ({ ...prev, [ticketId]: { status: data.data!.estado, url: data.data!.url ?? null } }))
        setSelectedIds(prev => { const s = new Set(prev); s.delete(ticketId); return s })
      } else {
        showToast('Error: ' + (data.error ?? 'Error desconocido'))
      }
    } catch {
      showToast('Error de conexión')
    } finally {
      setEnviandoIds(prev => { const s = new Set(prev); s.delete(ticketId); return s })
    }
  }, [])

  async function handleAnular(ticketId: string, motivo?: string) {
    setAnulandoId(ticketId)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; warning?: string }
      if (res.ok && data.ok) {
        setAnuladoLocal(prev => new Set([...prev, ticketId]))
        setSelectedIds(prev => { const s = new Set(prev); s.delete(ticketId); return s })
        setAnularModal(null)
        showToast(data.warning ? `Anulado (Verifactu: ${data.warning})` : 'Ticket anulado correctamente')
      } else {
        showToast('Error: ' + (data.error ?? 'Error al anular'))
      }
    } catch {
      showToast('Error de conexión')
    } finally {
      setAnulandoId(null)
    }
  }

  async function enviarSeleccionados() {
    setBatchConfirm(false)
    const ids = [...selectedIds]
    for (const id of ids) {
      await enviarTicket(id, 'F2')
    }
    setSelectedIds(new Set())
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleMovimientoAdded(m: Movimiento) {
    setMovimientos(prev => [m, ...prev])
    setModalTipo(null)
    showToast('Movimiento añadido correctamente')
  }

  async function handleEliminar(id: string) {
    if (!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return
    setEliminandoId(id)
    const supabase = createClient()
    const { error } = await supabase.from('movimientos').delete().eq('id', id)
    setEliminandoId(null)
    if (error) { showToast('Error al eliminar: ' + error.message); return }
    setMovimientos(prev => prev.filter(m => m.id !== id))
    showToast('Movimiento eliminado')
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-[#0f172a] text-white text-sm rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* A — Filtro período */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mr-1">Período:</span>
        {PERIODOS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              periodo === p.value
                ? 'bg-[#0f172a] text-white border-[#0f172a]'
                : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* B — Tabs */}
      <div className="flex border-b border-[#e2e8f0]">
        {(['movimientos', 'tickets'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t
                ? 'border-[#0f172a] text-[#0f172a]'
                : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            {t === 'movimientos' ? 'Movimientos' : `Tickets (${num_tickets})`}
          </button>
        ))}
      </div>

      {/* C — Tarjetas resumen (ambas tabs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta titulo="Ingresos TPV" valor={ingresos_tpv} subtexto={`${num_tickets} ticket${num_tickets !== 1 ? 's' : ''}`} color="verde" />
        <Tarjeta titulo="Ingresos manuales" valor={ingresos_manuales} color="azul" />
        <Tarjeta titulo="Gastos" valor={gastos_total} color="rojo" />
        <Tarjeta titulo="Beneficio neto" valor={beneficio_neto} color={beneficio_neto >= 0 ? 'verde' : 'rojo'} signo />
      </div>

      {/* D — Contenido por tab */}
      {tab === 'movimientos' && (
        <>
          {/* Gráfico */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
            <h2 className="text-sm font-semibold text-[#0f172a] mb-4">Últimos 6 meses</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="periodo" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={72} tickFormatter={v => v.toLocaleString('es-ES') + ' €'} />
                <Tooltip
                  formatter={(value, name) => [fmt(Number(value)), name]}
                  labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Botones añadir */}
          <div className="flex gap-3">
            <button
              onClick={() => setModalTipo('ingreso')}
              className="px-4 py-2.5 text-sm bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span> Añadir ingreso
            </button>
            <button
              onClick={() => setModalTipo('gasto')}
              className="px-4 py-2.5 text-sm bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span> Añadir gasto
            </button>
          </div>

          {/* Tabla movimientos */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0f172a]">
                Todos los movimientos {movimientos.length > 0 && `(${movimientos.length})`}
              </h2>
              <span className="text-xs text-[#94a3b8]">El período solo afecta al resumen</span>
            </div>

            {movimientos.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm text-[#94a3b8]">Aún no hay movimientos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-slate-50">
                      {['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Importe', 'Acciones'].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider ${h === 'Importe' || h === 'Acciones' ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => {
                      const recLabel = etiquetaRecurrencia(m)
                      return (
                        <tr key={m.id} className="border-b border-[#f1f5f9] hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-[#64748b] whitespace-nowrap">{m.fecha}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-block w-fit px-2 py-0.5 text-xs font-semibold rounded-full ${m.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                              </span>
                              {recLabel && (
                                <span className="inline-block w-fit px-2 py-0.5 text-xs font-medium rounded-full bg-violet-100 text-violet-700">
                                  {recLabel}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#0f172a]">
                            <span>{m.concepto}</span>
                            {m.notas && <span className="block text-xs text-[#94a3b8]">{m.notas}</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#64748b]">{m.categoria}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold whitespace-nowrap ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                            {m.tipo === 'ingreso' ? '+' : '−'}{fmt(Number(m.importe))}
                            {recLabel && <span className="block text-xs font-normal text-[#94a3b8]">{m.recurrencia === 'mensual' ? '/mes' : '/año'}</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleEliminar(m.id)}
                              disabled={eliminandoId === m.id}
                              className="px-2 py-1 text-xs bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
                            >
                              {eliminandoId === m.id ? '...' : 'Eliminar'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal movimiento */}
          {modalTipo && (
            <MovimientoModal
              tipo={modalTipo}
              restaurantId={restaurantId}
              onClose={() => setModalTipo(null)}
              onSaved={handleMovimientoAdded}
            />
          )}
        </>
      )}

      {tab === 'tickets' && (
        <>
          {/* ── Pendientes de envío ────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-[#0f172a]">
                Pendientes de envío a Verifactu
                {ticketsPendientes.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">
                    {ticketsPendientes.length}
                  </span>
                )}
              </h2>
              {ticketsPendientes.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const elegibles = ticketsPendientes.filter(t => !t.anulado && !anuladoLocal.has(t.id))
                      if (selectedIds.size === elegibles.length && elegibles.length > 0) {
                        setSelectedIds(new Set())
                      } else {
                        setSelectedIds(new Set(elegibles.map(t => t.id)))
                      }
                    }}
                    className="text-xs text-[#64748b] hover:text-[#0f172a] underline"
                  >
                    {selectedIds.size === ticketsPendientes.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => setBatchConfirm(true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Enviar seleccionados ({selectedIds.size})
                    </button>
                  )}
                </div>
              )}
            </div>

            {ticketsPendientes.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">✓</div>
                <p className="text-sm text-[#94a3b8]">Todos los tickets de este período están enviados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-slate-50">
                      <th className="px-4 py-3 w-8" />
                      {['Nº Ticket', 'Fecha', 'Mesa', 'Método', 'Total', ''].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider ${h === 'Total' || h === '' ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ticketsPendientes.map(t => {
                      const enviando = enviandoIds.has(t.id)
                      const seleccionado = selectedIds.has(t.id)
                      const isAnulado = t.anulado || anuladoLocal.has(t.id)
                      return (
                        <tr key={t.id} className={`border-b border-[#f1f5f9] transition-colors ${isAnulado ? 'opacity-60 bg-red-50/40' : seleccionado ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3">
                            {!isAnulado && (
                              <input
                                type="checkbox"
                                checked={seleccionado}
                                onChange={() => {
                                  setSelectedIds(prev => {
                                    const s = new Set(prev)
                                    s.has(t.id) ? s.delete(t.id) : s.add(t.id)
                                    return s
                                  })
                                }}
                                className="w-4 h-4 accent-blue-600"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-[#0f172a]">{t.numero_ticket}</td>
                          <td className="px-4 py-3 text-sm text-[#64748b] whitespace-nowrap">
                            {new Date(t.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#64748b]">{t.mesa_nombre}</td>
                          <td className="px-4 py-3 text-sm text-[#64748b]">{METODO_LABEL[t.metodo_pago] ?? t.metodo_pago}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-[#0f172a]">{fmt(t.total)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isAnulado && (
                                <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">ANULADO</span>
                              )}
                              <button
                                onClick={() => setTicketModalId(t.id)}
                                className="px-2.5 py-1.5 text-xs bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 transition-colors"
                              >
                                Ver
                              </button>
                              {!isAnulado && (
                                <button
                                  onClick={() => setEditModal({ ticketId: t.id, numero: t.numero_ticket, total: t.total })}
                                  disabled={enviando}
                                  className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  {enviando ? '...' : 'Enviar'}
                                </button>
                              )}
                              {!isAnulado && (
                                <button
                                  onClick={() => setAnularModal({ ticketId: t.id, numero: t.numero_ticket, total: t.total, fecha: t.fecha, yaEnviado: false })}
                                  className="px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  Anular
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Enviados a Verifactu ───────────────────────── */}
          {ticketsEnviados.length > 0 && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e8f0]">
                <h2 className="text-sm font-semibold text-[#0f172a]">
                  Enviados a Verifactu
                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                    {ticketsEnviados.length}
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-slate-50">
                      {['Nº Ticket', 'Fecha', 'Mesa', 'Total', 'Estado', ''].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider ${h === 'Total' || h === '' ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ticketsEnviados.map(t => {
                      const isAnulado = t.anulado || anuladoLocal.has(t.id)
                      return (
                        <tr key={t.id} className={`border-b border-[#f1f5f9] transition-colors ${isAnulado ? 'opacity-60 bg-red-50/40' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 text-sm font-mono text-[#0f172a]">{t.numero_ticket}</td>
                          <td className="px-4 py-3 text-sm text-[#64748b] whitespace-nowrap">
                            {new Date(t.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#64748b]">{t.mesa_nombre}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-[#0f172a]">{fmt(t.total)}</td>
                          <td className="px-4 py-3">
                            {isAnulado ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                ✕ ANULADO
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                t.verifactu_status === 'Correcto' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {t.verifactu_status === 'Correcto' ? '✓' : '⏳'} {t.verifactu_status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setTicketModalId(t.id)}
                                className="px-2.5 py-1.5 text-xs bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 transition-colors"
                              >
                                Ver
                              </button>
                              {!isAnulado && t.verifactu_url && (
                                <button
                                  onClick={() => window.open(t.verifactu_url!, '_blank', 'noopener,noreferrer')}
                                  className="px-2.5 py-1.5 text-xs font-semibold border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                                >
                                  AEAT
                                </button>
                              )}
                              {!isAnulado && (
                                <button
                                  onClick={() => setAnularModal({ ticketId: t.id, numero: t.numero_ticket, total: t.total, fecha: t.fecha, yaEnviado: true })}
                                  disabled={anulandoId === t.id}
                                  className="px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                                >
                                  {anulandoId === t.id ? '...' : 'Anular'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modales */}
          {ticketModalId && (
            <TicketPreview ticketId={ticketModalId} onClose={() => setTicketModalId(null)} />
          )}
          {editModal && (
            <EditEnviarModal
              ticketId={editModal.ticketId}
              numero={editModal.numero}
              total={editModal.total}
              enviando={enviandoIds.has(editModal.ticketId)}
              onClose={() => setEditModal(null)}
              onConfirm={(tipo, nif, nombre) => {
                enviarTicket(editModal.ticketId, tipo, nif, nombre)
                setEditModal(null)
              }}
            />
          )}
          {batchConfirm && (
            <BatchConfirmModal
              count={selectedIds.size}
              onClose={() => setBatchConfirm(false)}
              onConfirm={enviarSeleccionados}
            />
          )}
          {anularModal && (
            <AnularModal
              numero={anularModal.numero}
              total={anularModal.total}
              fecha={anularModal.fecha}
              yaEnviado={anularModal.yaEnviado}
              anulando={anulandoId === anularModal.ticketId}
              onClose={() => setAnularModal(null)}
              onConfirm={(motivo) => handleAnular(anularModal.ticketId, motivo)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─── Tarjeta resumen ──────────────────────────────────────────────────────────

type ColorTarjeta = 'verde' | 'azul' | 'rojo'
const COLOR_MAP: Record<ColorTarjeta, { bg: string; border: string; label: string; value: string }> = {
  verde: { bg: 'bg-green-50',  border: 'border-green-200',  label: 'text-green-600', value: 'text-green-700' },
  azul:  { bg: 'bg-blue-50',   border: 'border-blue-200',   label: 'text-blue-600',  value: 'text-blue-700' },
  rojo:  { bg: 'bg-red-50',    border: 'border-red-200',    label: 'text-red-600',   value: 'text-red-700' },
}

function Tarjeta({ titulo, valor, subtexto, color, signo }: {
  titulo: string; valor: number; subtexto?: string; color: ColorTarjeta; signo?: boolean
}) {
  const c = COLOR_MAP[color]
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <p className={`text-xs font-medium ${c.label} mb-1`}>{titulo}</p>
      <p className={`text-xl font-bold ${c.value}`}>
        {signo && valor > 0 ? '+' : ''}{valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
      </p>
      {subtexto && <p className={`text-xs ${c.label} mt-0.5`}>{subtexto}</p>}
    </div>
  )
}

// ─── Modal añadir movimiento ──────────────────────────────────────────────────

function MovimientoModal({ tipo, restaurantId, onClose, onSaved }: {
  tipo: MovimientoTipo; restaurantId: string; onClose: () => void; onSaved: (m: Movimiento) => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [concepto,    setConcepto]    = useState('')
  const [importe,     setImporte]     = useState('')
  const [categoria,   setCategoria]   = useState('')
  const [fecha,       setFecha]       = useState(today)
  const [recurrencia, setRecurrencia] = useState<Recurrencia>('unico')
  const [notas,       setNotas]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const infoRecurrencia = useMemo(() => {
    if (recurrencia === 'unico') return null
    const d = new Date(fecha + 'T00:00:00')
    if (recurrencia === 'mensual') return `Se repetirá cada mes el día ${d.getDate()}`
    if (recurrencia === 'anual')   return `Se repetirá cada año el ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`
    return null
  }, [recurrencia, fecha])

  async function handleGuardar() {
    if (!concepto.trim())                          { setError('El concepto es obligatorio'); return }
    const importeNum = parseFloat(importe.replace(',', '.'))
    if (isNaN(importeNum) || importeNum <= 0)      { setError('El importe debe ser mayor que 0'); return }
    if (!categoria)                                { setError('La categoría es obligatoria'); return }
    if (!fecha)                                    { setError('La fecha es obligatoria'); return }

    setError(null)
    setSaving(true)

    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('movimientos')
      .insert({ restaurant_id: restaurantId, tipo, concepto: concepto.trim(), importe: importeNum, categoria, fecha, recurrencia, notas: notas.trim() || null })
      .select()
      .single()

    setSaving(false)
    if (err || !data) { setError(err?.message ?? 'Error al guardar'); return }
    onSaved(data as Movimiento)
  }

  const esIngreso = tipo === 'ingreso'
  const accentBtn = esIngreso ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
          <h3 className="text-base font-bold text-[#0f172a]">
            {esIngreso ? 'Añadir ingreso' : 'Añadir gasto'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-slate-100 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#64748b] mb-1">Concepto *</label>
            <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)}
              placeholder="Describe el movimiento"
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Importe (€) *</label>
              <input type="number" min="0.01" step="0.01" value={importe} onChange={e => setImporte(e.target.value)}
                placeholder="0,00"
                className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">
                {recurrencia === 'unico' ? 'Fecha *' : 'Fecha de inicio *'}
              </label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748b] mb-1">Categoría *</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-white">
              <option value="">Seleccionar categoría</option>
              {CATEGORIAS[tipo].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748b] mb-2">Repetición</label>
            <div className="grid grid-cols-3 gap-2">
              {RECURRENCIAS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRecurrencia(r.value)}
                  className={`px-3 py-2 text-sm rounded-xl border text-center transition-colors ${
                    recurrencia === r.value
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-slate-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {infoRecurrencia && (
              <p className="mt-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                🔁 {infoRecurrencia}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748b] mb-1">Notas (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 resize-none" />
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-xl text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white ${accentBtn} disabled:opacity-50`}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal editar y enviar ticket a Verifactu ─────────────────────────────────

function EditEnviarModal({ ticketId: _ticketId, numero, total, enviando, onClose, onConfirm }: {
  ticketId: string
  numero: string
  total: number
  enviando: boolean
  onClose: () => void
  onConfirm: (tipo: 'F1' | 'F2', nif?: string, nombre?: string) => void
}) {
  const [tipo, setTipo] = useState<'F1' | 'F2'>('F2')
  const [nif, setNif] = useState('')
  const [nombre, setNombre] = useState('')

  function handleConfirm() {
    onConfirm(tipo, tipo === 'F1' ? nif.trim() || undefined : undefined, tipo === 'F1' ? nombre.trim() || undefined : undefined)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
          <div>
            <h3 className="text-base font-bold text-[#0f172a]">Enviar a Verifactu</h3>
            <p className="text-xs text-[#64748b] mt-0.5">Ticket {numero} · {total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#0f172a] text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748b] mb-2">Tipo de factura</label>
            <div className="grid grid-cols-2 gap-2">
              {(['F2', 'F1'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-colors ${
                    tipo === t ? 'bg-blue-600 text-white border-blue-600' : 'border-[#e2e8f0] text-[#64748b] hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold">{t}</div>
                  <div className={`text-xs mt-0.5 ${tipo === t ? 'text-blue-100' : 'text-[#94a3b8]'}`}>
                    {t === 'F2' ? 'Simplificada' : 'Factura completa'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {tipo === 'F1' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] mb-1">NIF del cliente</label>
                <input
                  type="text"
                  value={nif}
                  onChange={e => setNif(e.target.value)}
                  placeholder="12345678A"
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] mb-1">Nombre del cliente</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Nombre o razón social"
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={enviando}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {enviando ? 'Enviando...' : 'Confirmar y enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal anulación de ticket ────────────────────────────────────────────────

function AnularModal({ numero, total, fecha, yaEnviado, anulando, onClose, onConfirm }: {
  numero: string
  total: number
  fecha: string
  yaEnviado: boolean
  anulando: boolean
  onClose: () => void
  onConfirm: (motivo?: string) => void
}) {
  const [motivo, setMotivo] = useState('')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
          <h3 className="text-base font-bold text-[#0f172a]">Anular ticket</h3>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#0f172a] text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-[#64748b]">Ticket</span>
              <span className="font-mono font-semibold text-[#0f172a]">{numero}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Importe</span>
              <span className="font-semibold text-[#0f172a]">{total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Fecha</span>
              <span className="text-[#0f172a]">{new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
          </div>

          {yaEnviado && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <span className="mt-0.5 flex-shrink-0">⚠️</span>
              <span>Este ticket fue enviado a Verifactu. La anulación notificará a la AEAT con tipo R5.</span>
            </div>
          )}

          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
            <span className="mt-0.5 flex-shrink-0">🚫</span>
            <span>Esta acción es irreversible.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748b] mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: error en artículos, duplicado..."
              className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm text-black outline-none focus:border-red-300"
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} disabled={anulando}
            className="flex-1 py-2.5 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(motivo.trim() || undefined)}
            disabled={anulando}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {anulando ? 'Anulando...' : 'Confirmar anulación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal confirmación envío múltiple ────────────────────────────────────────

function BatchConfirmModal({ count, onClose, onConfirm }: {
  count: number
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h3 className="text-base font-bold text-[#0f172a]">Enviar {count} tickets</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[#64748b]">
            Se enviarán <span className="font-semibold text-[#0f172a]">{count} tickets</span> a Verifactu como <span className="font-semibold">factura simplificada (F2)</span>.
          </p>
          <p className="text-xs text-[#94a3b8] mt-2">
            Para facturas completas con NIF de cliente, envíalos uno a uno.
          </p>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Confirmar y enviar
          </button>
        </div>
      </div>
    </div>
  )
}
