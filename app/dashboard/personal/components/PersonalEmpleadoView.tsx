'use client'

import { useState } from 'react'
import type { Turno, DiaLibre, SolicitudVacacion } from '@/types/personal'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function parseMes(mes: string): { year: number; month: number } {
  const [y, m] = mes.split('-').map(Number)
  return { year: y, month: m - 1 }
}

function formatMes(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function mesAnterior(mes: string): string {
  const { year, month } = parseMes(mes)
  const d = new Date(year, month - 1, 1)
  return formatMes(d.getFullYear(), d.getMonth())
}

function mesSiguiente(mes: string): string {
  const { year, month } = parseMes(mes)
  const d = new Date(year, month + 1, 1)
  return formatMes(d.getFullYear(), d.getMonth())
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function buildDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  aprobada: 'bg-green-100 text-green-800 border-green-200',
  denegada: 'bg-red-100 text-red-800 border-red-200',
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  denegada: 'Denegada',
}

interface Props {
  userId: string
  nombre: string
  turnos: Turno[]
  diasLibres: DiaLibre[]
  solicitudes: SolicitudVacacion[]
  mesActual: string
}

export default function PersonalEmpleadoView({
  userId,
  nombre,
  turnos: turnosIniciales,
  diasLibres: diasLibresIniciales,
  solicitudes: solicitudesIniciales,
  mesActual,
}: Props) {
  const [mes, setMes] = useState(mesActual)
  const [turnos, setTurnos] = useState<Turno[]>(turnosIniciales)
  const [diasLibres, setDiasLibres] = useState<DiaLibre[]>(diasLibresIniciales)
  const [solicitudes, setSolicitudes] = useState<SolicitudVacacion[]>(solicitudesIniciales)
  const [cargando, setCargando] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [diaPreseleccionado, setDiaPreseleccionado] = useState('')
  const [toast, setToast] = useState<{ msg: string; tipo: 'exito' | 'error' } | null>(null)

  const { year, month } = parseMes(mes)

  function mostrarToast(msg: string, tipo: 'exito' | 'error') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 4000)
  }

  async function cambiarMes(nuevoMes: string) {
    setCargando(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/personal/turnos?mes=${nuevoMes}&empleado_id=${userId}`),
        fetch(`/api/personal/dias-libres?mes=${nuevoMes}&empleado_id=${userId}`),
      ])
      const [d1, d2] = await Promise.all([r1.json(), r2.json()])
      setTurnos(d1.turnos ?? [])
      setDiasLibres(d2.diasLibres ?? [])
      setMes(nuevoMes)
    } catch {
      mostrarToast('Error al cargar datos', 'error')
    } finally {
      setCargando(false)
    }
  }

  // Resumen
  const añoActual = new Date().getFullYear().toString()
  const vacacionesAprobadas = solicitudes.filter(
    s => s.estado === 'aprobada' && s.fecha_inicio.startsWith(añoActual)
  ).length
  const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente').length

  // Calendario
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7
  const diasMes = new Date(year, month + 1, 0).getDate()
  const celdas: (number | null)[] = []
  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null)
  for (let d = 1; d <= diasMes; d++) celdas.push(d)
  while (celdas.length % 7 !== 0) celdas.push(null)

  function getEventosDia(dia: number) {
    const dateStr = buildDateStr(year, month, dia)
    return {
      turnos: turnos.filter(t => t.fecha === dateStr),
      diasLibres: diasLibres.filter(d => d.fecha === dateStr),
      vacacionesAprobadas: solicitudes.filter(s => s.estado === 'aprobada' && s.fecha_inicio <= dateStr && s.fecha_fin >= dateStr),
      vacacionesPendientes: solicitudes.filter(s => s.estado === 'pendiente' && s.fecha_inicio <= dateStr && s.fecha_fin >= dateStr),
    }
  }

  function handleClickDia(dia: number) {
    const eventos = getEventosDia(dia)
    const sinEventos =
      eventos.turnos.length === 0 &&
      eventos.diasLibres.length === 0 &&
      eventos.vacacionesAprobadas.length === 0 &&
      eventos.vacacionesPendientes.length === 0
    if (sinEventos) {
      setDiaPreseleccionado(buildDateStr(year, month, dia))
      setModalAbierto(true)
    }
  }

  async function handleCancelarSolicitud(id: string) {
    if (!confirm('¿Cancelar esta solicitud de vacaciones?')) return
    try {
      const res = await fetch(`/api/personal/vacaciones/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al cancelar', 'error'); return }
      setSolicitudes(prev => prev.filter(s => s.id !== id))
      mostrarToast('Solicitud cancelada', 'exito')
    } catch {
      mostrarToast('Error de conexión', 'error')
    }
  }

  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cabecera */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Mi Panel</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{nombre}</p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{vacacionesAprobadas}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Vacaciones aprobadas este año</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{solicitudesPendientes}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Solicitudes pendientes</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{turnos.length}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Turnos este mes</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-[var(--text-secondary)]">{diasLibres.length}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Días libres este mes</div>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => cambiarMes(mesAnterior(mes))}
            disabled={cargando}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 transition-colors"
          >
            ← Anterior
          </button>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {MESES[month]} {year}
          </h3>
          <button
            onClick={() => cambiarMes(mesSiguiente(mes))}
            disabled={cargando}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 transition-colors"
          >
            Siguiente →
          </button>
        </div>

        {/* Cabecera días semana */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-[var(--text-muted)] py-1">{d}</div>
          ))}
        </div>

        {/* Celdas */}
        <div className={`grid grid-cols-7 gap-1 ${cargando ? 'opacity-40 pointer-events-none' : ''}`}>
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={i} />
            const eventos = getEventosDia(dia)
            const tieneEventos =
              eventos.turnos.length > 0 ||
              eventos.diasLibres.length > 0 ||
              eventos.vacacionesAprobadas.length > 0 ||
              eventos.vacacionesPendientes.length > 0
            const dateStr = buildDateStr(year, month, dia)
            const esHoy = dateStr === hoy

            return (
              <div
                key={i}
                onClick={() => handleClickDia(dia)}
                className={`min-h-[60px] rounded-lg p-1 border transition-colors ${
                  esHoy
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-transparent hover:border-[var(--border)]'
                } ${!tieneEventos ? 'cursor-pointer hover:bg-[var(--bg-surface-hover)]' : 'cursor-default'}`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${esHoy ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                  {dia}
                </div>
                <div className="flex flex-col gap-0.5">
                  {eventos.vacacionesAprobadas.length > 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 rounded px-1 leading-4 truncate">Vacaciones</span>
                  )}
                  {eventos.vacacionesPendientes.length > 0 && (
                    <span className="text-[10px] bg-yellow-100 text-yellow-700 rounded px-1 leading-4 truncate">Pendiente</span>
                  )}
                  {eventos.turnos.map(t => (
                    <span key={t.id} className="text-[10px] bg-green-100 text-green-700 rounded px-1 leading-4 truncate">
                      {t.hora_inicio.slice(0, 5)}-{t.hora_fin.slice(0, 5)}
                    </span>
                  ))}
                  {eventos.diasLibres.map(d => (
                    <span key={d.id} className="text-[10px] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] rounded px-1 leading-4 truncate">
                      {d.tipo === 'libre' ? 'Libre' : d.tipo === 'festivo' ? 'Festivo' : 'Baja'}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--border)]">
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded bg-green-100 inline-block" /> Turno
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded bg-[var(--bg-surface-hover)] inline-block" /> Día libre
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded bg-blue-100 inline-block" /> Vacaciones aprobadas
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded bg-yellow-100 inline-block" /> Solicitud pendiente
          </span>
        </div>
      </div>

      {/* Botón solicitar vacaciones */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { setDiaPreseleccionado(''); setModalAbierto(true) }}
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary-hover)] transition-colors"
        >
          + Solicitar vacaciones
        </button>
      </div>

      {/* Lista de solicitudes */}
      {solicitudes.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Mis solicitudes</h3>
          <div className="flex flex-col gap-3">
            {solicitudes.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-hover)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[s.estado]}`}>
                      {ESTADO_LABEL[s.estado]}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {formatFecha(s.fecha_inicio)} — {formatFecha(s.fecha_fin)}
                    </span>
                  </div>
                  {s.motivo && (
                    <p className="text-xs text-[var(--text-secondary)] truncate">{s.motivo}</p>
                  )}
                  {s.comentario_respuesta && (
                    <p className="text-xs text-[var(--text-muted)] mt-1 italic">"{s.comentario_respuesta}"</p>
                  )}
                </div>
                {s.estado === 'pendiente' && (
                  <button
                    onClick={() => handleCancelarSolicitud(s.id)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal solicitar vacaciones */}
      {modalAbierto && (
        <ModalSolicitarVacaciones
          userId={userId}
          diaInicial={diaPreseleccionado}
          onClose={() => setModalAbierto(false)}
          onCreada={(s) => {
            setSolicitudes(prev => [s, ...prev])
            mostrarToast('Solicitud enviada correctamente', 'exito')
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Modal solicitar vacaciones ──────────────────────────────────────────────

function ModalSolicitarVacaciones({
  userId,
  diaInicial,
  onClose,
  onCreada,
}: {
  userId: string
  diaInicial: string
  onClose: () => void
  onCreada: (s: SolicitudVacacion) => void
}) {
  const hoy = new Date().toISOString().split('T')[0]
  const [fechaInicio, setFechaInicio] = useState(diaInicial || hoy)
  const [fechaFin, setFechaFin] = useState(diaInicial || hoy)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function handleConfirmar() {
    setError(null)
    if (fechaInicio < hoy) { setError('La fecha de inicio no puede ser en el pasado'); return }
    if (fechaFin < fechaInicio) { setError('La fecha de fin debe ser igual o posterior a la fecha de inicio'); return }

    setGuardando(true)
    try {
      const res = await fetch('/api/personal/vacaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empleado_id: userId, fecha_inicio: fechaInicio, fecha_fin: fechaFin, motivo: motivo.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar la solicitud'); return }
      onCreada(data.solicitud)
      onClose()
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Solicitar vacaciones</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              min={hoy}
              onChange={e => setFechaInicio(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={e => setFechaFin(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Vacaciones familiares"
              rows={3}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={guardando}
            className="flex-1 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            {guardando ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>
  )
}
