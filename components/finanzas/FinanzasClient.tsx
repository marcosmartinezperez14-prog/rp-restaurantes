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
    if (!confirm('¿Eliminar este movimiento?')) return
    setEliminandoId(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('movimientos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    setEliminandoId(null)
    if (error) { showToast('Error al eliminar: ' + error.message); return }
    setMovimientos(prev => prev.filter(m => m.id !== id))
    showToast('Movimiento enviado a la papelera')
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#f6f6f7' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 40px 56px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '12px 16px', background: '#14171d', color: '#fff', fontSize: 13, borderRadius: 12, boxShadow: '0 8px 24px rgba(20,23,29,0.22)' }}>
          {toast}
        </div>
      )}

      {/* A — Período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', color: '#9a9da3' }}>PERÍODO</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              style={{
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                padding: '8px 15px', borderRadius: 9,
                border: `1px solid ${periodo === p.value ? '#14171d' : '#e6e6e8'}`,
                background: periodo === p.value ? '#14171d' : '#fff',
                color: periodo === p.value ? '#fff' : '#6b6f77',
                transition: 'all .14s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* B — Tabs */}
      <div style={{ display: 'flex', gap: 26, borderBottom: '1px solid #e7e7e9', margin: '18px 0 22px' }}>
        <button
          onClick={() => setTab('movimientos')}
          style={{
            cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit',
            fontSize: 14, fontWeight: tab === 'movimientos' ? 700 : 600,
            color: tab === 'movimientos' ? '#181b21' : '#9a9da3',
            padding: '0 0 13px', borderBottom: `2px solid ${tab === 'movimientos' ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, transition: 'all .14s ease',
          }}
        >
          Movimientos
        </button>
        <button
          onClick={() => setTab('tickets')}
          style={{
            cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit',
            fontSize: 14, fontWeight: tab === 'tickets' ? 700 : 600,
            color: tab === 'tickets' ? '#181b21' : '#9a9da3',
            padding: '0 0 13px', borderBottom: `2px solid ${tab === 'tickets' ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, display: 'flex', alignItems: 'center', gap: 7, transition: 'all .14s ease',
          }}
        >
          Tickets
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#b6b8bd', background: '#efefef', borderRadius: 5, padding: '1px 6px' }}>
            {num_tickets}
          </span>
        </button>
      </div>

      {/* C — KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 18 }}>
        <KpiCard
          label="Ingresos TPV" value={fmt(ingresos_tpv)}
          sub={`${num_tickets} TICKET${num_tickets !== 1 ? 'S' : ''}`}
          accent="#1f5d4c" valueColor="#16876a" iconBg="rgba(31,93,76,0.08)"
          icon={<><path d="M3 17l5-5 4 3 6-7"/><path d="M17 8h3v3"/></>}
        />
        <KpiCard
          label="Ingresos manuales" value={fmt(ingresos_manuales)}
          sub="AÑADIDOS A MANO"
          accent="#2f5fa6" valueColor="#2f5fa6" iconBg="rgba(47,95,166,0.08)"
          icon={<path d="M12 5v14M5 12h14"/>}
        />
        <KpiCard
          label="Gastos" value={fmt(gastos_total)}
          sub={movimientos.filter(m => m.tipo === 'gasto').length === 0 ? 'SIN REGISTROS' : `${movimientos.filter(m => m.tipo === 'gasto').length} MOVIMIENTOS`}
          accent="#c0492f" valueColor="#c0492f" iconBg="rgba(192,73,47,0.08)"
          icon={<path d="M5 12h14"/>}
        />
        <KpiCard
          label="Beneficio neto" value={(beneficio_neto >= 0 ? '' : '−') + fmt(Math.abs(beneficio_neto))}
          sub="INGRESOS − GASTOS"
          accent={beneficio_neto >= 0 ? '#1f5d4c' : '#c0492f'}
          valueColor={beneficio_neto >= 0 ? '#181b21' : '#c0492f'}
          iconBg={beneficio_neto >= 0 ? 'rgba(31,93,76,0.08)' : 'rgba(192,73,47,0.08)'}
          icon={<path d="M12 2v20M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>}
        />
      </div>

      {/* D — Contenido por tab */}
      {tab === 'movimientos' && (
        <>
          {/* Gráfico */}
          <section style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, padding: '22px 24px', boxShadow: '0 1px 2px rgba(20,23,29,0.04)', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>Últimos 6 meses</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#a7a9af', marginTop: 3 }}>INGRESOS VS. GASTOS</div>
              </div>
              <div style={{ display: 'flex', gap: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 18, height: 3, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: '#5f636b', fontWeight: 500 }}>Ingresos</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 18, height: 3, borderRadius: 2, background: '#d2554a', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: '#5f636b', fontWeight: 500 }}>Gastos</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={datosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 5" stroke="#f0f0f1" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize: 12, fill: '#9a9da3', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#b6b8bd', fontFamily: 'ui-monospace, monospace' }} width={72} tickFormatter={v => '€' + v.toLocaleString('es-ES')} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value, name) => [fmt(Number(value)), name]}
                  labelStyle={{ color: '#181b21', fontWeight: 600, fontSize: 13 }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e8e8ea', fontSize: 12, boxShadow: '0 4px 12px rgba(20,23,29,0.08)' }}
                  cursor={{ fill: '#f8f8f9' }}
                />
                <Bar dataKey="Ingresos" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill="#d2554a" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
            {datosGrafico.every(d => d.Ingresos === 0 && d.Gastos === 0) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 6, paddingTop: 14, borderTop: '1px solid #f0f0f1' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b6b8bd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>
                </svg>
                <span style={{ fontSize: 12.5, color: '#a7a9af' }}>Sin movimientos registrados todavía en este período.</span>
              </div>
            )}
          </section>

          {/* Botones añadir */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <button
              onClick={() => setModalTipo('ingreso')}
              style={{
                cursor: 'pointer', height: 44, border: 'none', borderRadius: 11,
                background: 'var(--accent)', color: '#fff', fontFamily: 'inherit',
                fontSize: 13.5, fontWeight: 700, padding: '0 18px',
                display: 'flex', alignItems: 'center', gap: 9,
                boxShadow: '0 6px 16px rgba(31,93,76,0.18)', transition: 'filter .15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Añadir ingreso
            </button>
            <button
              onClick={() => setModalTipo('gasto')}
              style={{
                cursor: 'pointer', height: 44, border: '1.5px solid #e6dede', borderRadius: 11,
                background: '#fff', color: '#c0492f', fontFamily: 'inherit',
                fontSize: 13.5, fontWeight: 700, padding: '0 18px',
                display: 'flex', alignItems: 'center', gap: 9, transition: 'all .15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/>
              </svg>
              Añadir gasto
            </button>
          </div>

          {/* Tabla movimientos */}
          <section style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, boxShadow: '0 1px 2px rgba(20,23,29,0.04)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f0f0f1' }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>
                Todos los movimientos {movimientos.length > 0 && `(${movimientos.length})`}
              </span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#b6b8bd' }}>El período solo afecta al resumen</span>
            </div>

            {movimientos.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 20px' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: '#f5f5f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c2c4c9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M4 12h16M4 17h10"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#6b6f77' }}>No hay movimientos registrados</div>
                <div style={{ fontSize: 12.5, color: '#a7a9af', marginTop: 4 }}>Añade un ingreso o un gasto para empezar a llevar tus cuentas.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                      {['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Importe', 'Acciones'].map(h => (
                        <th key={h} style={{
                          padding: '12px 16px', fontSize: 11, fontWeight: 700,
                          color: '#9a9da3', textTransform: 'uppercase', letterSpacing: '0.4px',
                          textAlign: h === 'Importe' || h === 'Acciones' ? 'right' : 'left',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => {
                      const recLabel = etiquetaRecurrencia(m)
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f4f4f5' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#9a9da3', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>{m.fecha}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{
                                display: 'inline-block', width: 'fit-content', padding: '2px 8px',
                                fontSize: 11, fontWeight: 700, borderRadius: 999,
                                background: m.tipo === 'ingreso' ? 'rgba(22,135,106,0.1)' : 'rgba(192,73,47,0.1)',
                                color: m.tipo === 'ingreso' ? '#16876a' : '#c0492f',
                              }}>
                                {m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                              </span>
                              {recLabel && (
                                <span style={{ display: 'inline-block', width: 'fit-content', padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 999, background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>
                                  {recLabel}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#1b1e24' }}>
                            <span>{m.concepto}</span>
                            {m.notas && <span style={{ display: 'block', fontSize: 12, color: '#9a9da3' }}>{m.notas}</span>}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b6f77' }}>{m.categoria}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: m.tipo === 'ingreso' ? '#16876a' : '#c0492f' }}>
                            {m.tipo === 'ingreso' ? '+' : '−'}{fmt(Number(m.importe))}
                            {recLabel && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: '#9a9da3' }}>{m.recurrencia === 'mensual' ? '/mes' : '/año'}</span>}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleEliminar(m.id)}
                              disabled={eliminandoId === m.id}
                              style={{
                                padding: '5px 10px', fontSize: 12, border: '1px solid #e6e6e8',
                                borderRadius: 8, background: '#fff', color: '#6b6f77',
                                cursor: eliminandoId === m.id ? 'default' : 'pointer',
                                opacity: eliminandoId === m.id ? 0.5 : 1, transition: 'all .15s ease',
                              }}
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
          </section>

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
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
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
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
                  >
                    {selectedIds.size === ticketsPendientes.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => setBatchConfirm(true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
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
                <p className="text-sm text-[var(--text-secondary)]">Todos los tickets de este período están enviados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-page)]">
                      <th className="px-4 py-3 w-8" />
                      {['Nº Ticket', 'Fecha', 'Mesa', 'Método', 'Total', ''].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${h === 'Total' || h === '' ? 'text-right' : 'text-left'}`}>
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
                        <tr key={t.id} className={`border-b border-[#f1f5f9] transition-colors ${isAnulado ? 'opacity-60 bg-red-50/40' : seleccionado ? 'bg-blue-50' : 'hover:bg-[var(--bg-page)]'}`}>
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
                          <td className="px-4 py-3 text-sm font-mono text-[var(--text-primary)]">{t.numero_ticket}</td>
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                            {new Date(t.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{t.mesa_nombre}</td>
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{METODO_LABEL[t.metodo_pago] ?? t.metodo_pago}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-[var(--text-primary)]">{fmt(t.total)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isAnulado && (
                                <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">ANULADO</span>
                              )}
                              <button
                                onClick={() => setTicketModalId(t.id)}
                                className="px-2.5 py-1.5 text-xs bg-slate-100 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-slate-200 transition-colors"
                              >
                                Ver
                              </button>
                              {!isAnulado && (
                                <button
                                  onClick={() => setEditModal({ ticketId: t.id, numero: t.numero_ticket, total: t.total })}
                                  disabled={enviando}
                                  className="px-2.5 py-1.5 text-xs font-semibold bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
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
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Enviados a Verifactu
                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                    {ticketsEnviados.length}
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-page)]">
                      {['Nº Ticket', 'Fecha', 'Mesa', 'Total', 'Estado', ''].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${h === 'Total' || h === '' ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ticketsEnviados.map(t => {
                      const isAnulado = t.anulado || anuladoLocal.has(t.id)
                      return (
                        <tr key={t.id} className={`border-b border-[#f1f5f9] transition-colors ${isAnulado ? 'opacity-60 bg-red-50/40' : 'hover:bg-[var(--bg-page)]'}`}>
                          <td className="px-4 py-3 text-sm font-mono text-[var(--text-primary)]">{t.numero_ticket}</td>
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                            {new Date(t.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{t.mesa_nombre}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-[var(--text-primary)]">{fmt(t.total)}</td>
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
                                className="px-2.5 py-1.5 text-xs bg-slate-100 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-slate-200 transition-colors"
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
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, valueColor, iconBg, icon }: {
  label: string; value: string; sub: string
  accent: string; valueColor: string; iconBg: string
  icon: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 15, padding: '18px 20px', boxShadow: '0 1px 2px rgba(20,23,29,0.04)', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6b6f77' }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </div>
      </div>
      <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.7px', color: valueColor }}>{value}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#a7a9af', marginTop: 5 }}>{sub}</div>
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
  const accentBtn = esIngreso ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]' : 'bg-red-600 hover:bg-red-700'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {esIngreso ? 'Añadir ingreso' : 'Añadir gasto'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-100 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Concepto *</label>
            <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)}
              placeholder="Describe el movimiento"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Importe (€) *</label>
              <input type="number" min="0.01" step="0.01" value={importe} onChange={e => setImporte(e.target.value)}
                placeholder="0,00"
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {recurrencia === 'unico' ? 'Fecha *' : 'Fecha de inicio *'}
              </label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Categoría *</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-[var(--bg-surface)]">
              <option value="">Seleccionar categoría</option>
              {CATEGORIAS[tipo].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">Repetición</label>
            <div className="grid grid-cols-3 gap-2">
              {RECURRENCIAS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRecurrencia(r.value)}
                  className={`px-3 py-2 text-sm rounded-xl border text-center transition-colors ${
                    recurrencia === r.value
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-page)]'
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
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notas (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 resize-none" />
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-page)]">
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
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Enviar a Verifactu</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Ticket {numero} · {total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">Tipo de factura</label>
            <div className="grid grid-cols-2 gap-2">
              {(['F2', 'F1'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-colors ${
                    tipo === t ? 'bg-[var(--accent)] text-white border-blue-600' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-page)]'
                  }`}
                >
                  <div className="font-semibold">{t}</div>
                  <div className={`text-xs mt-0.5 ${tipo === t ? 'text-blue-100' : 'text-[var(--text-secondary)]'}`}>
                    {t === 'F2' ? 'Simplificada' : 'Factura completa'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {tipo === 'F1' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">NIF del cliente</label>
                <input
                  type="text"
                  value={nif}
                  onChange={e => setNif(e.target.value)}
                  placeholder="12345678A"
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Nombre del cliente</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Nombre o razón social"
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-page)]">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={enviando}
            className="flex-1 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
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
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Anular ticket</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-[var(--bg-page)] rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Ticket</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">{numero}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Importe</span>
              <span className="font-semibold text-[var(--text-primary)]">{total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Fecha</span>
              <span className="text-[var(--text-primary)]">{new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
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
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: error en artículos, duplicado..."
              className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-black outline-none focus:border-red-300"
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} disabled={anulando}
            className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-page)] disabled:opacity-50">
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
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Enviar {count} tickets</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Se enviarán <span className="font-semibold text-[var(--text-primary)]">{count} tickets</span> a Verifactu como <span className="font-semibold">factura simplificada (F2)</span>.
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Para facturas completas con NIF de cliente, envíalos uno a uno.
          </p>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-page)]">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
          >
            Confirmar y enviar
          </button>
        </div>
      </div>
    </div>
  )
}
