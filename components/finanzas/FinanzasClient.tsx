'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import type { Movimiento, MovimientoTipo, Recurrencia } from '@/types/finanzas'

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

type Periodo = 'este_mes' | 'mes_anterior' | 'ultimos_3_meses' | 'este_ano' | 'todo'

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

// Calcula el importe total de un movimiento dentro del rango [desde, hasta]
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
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FinanzasClient({ movimientos: inicial, ingresos_tpv, num_tickets, restaurantId }: Props) {
  const [movimientos, setMovimientos] = useState(inicial)
  const [periodo, setPeriodo] = useState<Periodo>('este_mes')
  const [modalTipo, setModalTipo] = useState<MovimientoTipo | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

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

      {/* B — Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta titulo="Ingresos TPV" valor={ingresos_tpv} subtexto={`${num_tickets} ticket${num_tickets !== 1 ? 's' : ''}`} color="verde" />
        <Tarjeta titulo="Ingresos manuales" valor={ingresos_manuales} color="azul" />
        <Tarjeta titulo="Gastos" valor={gastos_total} color="rojo" />
        <Tarjeta titulo="Beneficio neto" valor={beneficio_neto} color={beneficio_neto >= 0 ? 'verde' : 'rojo'} signo />
      </div>

      {/* C — Gráfico */}
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

      {/* D — Botones */}
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

      {/* E — Tabla (muestra todos, el período solo afecta al resumen) */}
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

      {/* F — Modal */}
      {modalTipo && (
        <MovimientoModal
          tipo={modalTipo}
          restaurantId={restaurantId}
          onClose={() => setModalTipo(null)}
          onSaved={handleMovimientoAdded}
        />
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

  // Texto informativo dinámico según recurrencia y fecha
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

          {/* Concepto */}
          <div>
            <label className="block text-xs font-semibold text-[#64748b] mb-1">Concepto *</label>
            <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)}
              placeholder="Describe el movimiento"
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400" />
          </div>

          {/* Importe + Fecha */}
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

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-[#64748b] mb-1">Categoría *</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-white">
              <option value="">Seleccionar categoría</option>
              {CATEGORIAS[tipo].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Recurrencia */}
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

          {/* Notas */}
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
