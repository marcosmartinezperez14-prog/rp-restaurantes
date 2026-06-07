'use client'

import { useState } from 'react'
import type { Turno, DiaLibre, SolicitudVacacion, EmpleadoResumen, TipoTurno, TipoDiaLibre } from '@/types/personal'

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

function iniciales(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

function getRangoFechas(inicio: string, fin: string): string[] {
  const fechas: string[] = []
  const current = new Date(inicio + 'T00:00:00')
  const last = new Date(fin + 'T00:00:00')
  while (current <= last) {
    fechas.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return fechas
}

const TURNO_COLOR: Record<TipoTurno, string> = {
  normal: 'bg-green-100 text-green-700',
  extra: 'bg-orange-100 text-orange-700',
  guardia: 'bg-purple-100 text-purple-700',
}

const DIA_COLOR: Record<TipoDiaLibre, string> = {
  libre: 'bg-slate-100 text-slate-600',
  festivo: 'bg-blue-100 text-blue-700',
  baja: 'bg-red-100 text-red-700',
}

interface ModalDia {
  fecha: string
  empleadoId: string
  tab: 'turno' | 'diaLibre'
}

interface Props {
  empleados: EmpleadoResumen[]
  solicitudesPendientes: SolicitudVacacion[]
  turnos: Turno[]
  diasLibres: DiaLibre[]
  mesActual: string
}

export default function PersonalAdminView({
  empleados,
  solicitudesPendientes: solicitudesIniciales,
  turnos: turnosIniciales,
  diasLibres: diasLibresIniciales,
  mesActual,
}: Props) {
  const [mes, setMes] = useState(mesActual)
  const [turnos, setTurnos] = useState<Turno[]>(turnosIniciales)
  const [diasLibres, setDiasLibres] = useState<DiaLibre[]>(diasLibresIniciales)
  const [solicitudes, setSolicitudes] = useState<SolicitudVacacion[]>(solicitudesIniciales)
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<string>('todos')
  const [cargando, setCargando] = useState(false)
  const [modalDia, setModalDia] = useState<ModalDia | null>(null)
  const [modalDenegar, setModalDenegar] = useState<SolicitudVacacion | null>(null)
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
        fetch(`/api/personal/turnos?mes=${nuevoMes}`),
        fetch(`/api/personal/dias-libres?mes=${nuevoMes}`),
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

  async function handleAprobar(solicitud: SolicitudVacacion) {
    try {
      const res = await fetch(`/api/personal/vacaciones/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'aprobada' }),
      })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al aprobar', 'error'); return }
      setSolicitudes(prev => prev.filter(s => s.id !== solicitud.id))
      mostrarToast(`Vacaciones de ${solicitud.empleado?.nombre ?? ''} aprobadas`, 'exito')
    } catch {
      mostrarToast('Error de conexión', 'error')
    }
  }

  async function handleDenegar(solicitud: SolicitudVacacion, comentario: string) {
    try {
      const res = await fetch(`/api/personal/vacaciones/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'denegada', comentario_respuesta: comentario.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al denegar', 'error'); return }
      setSolicitudes(prev => prev.filter(s => s.id !== solicitud.id))
      setModalDenegar(null)
      mostrarToast(`Solicitud de ${solicitud.empleado?.nombre ?? ''} denegada`, 'exito')
    } catch {
      mostrarToast('Error de conexión', 'error')
    }
  }

  // Calendario
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7
  const diasMes = new Date(year, month + 1, 0).getDate()
  const celdas: (number | null)[] = []
  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null)
  for (let d = 1; d <= diasMes; d++) celdas.push(d)
  while (celdas.length % 7 !== 0) celdas.push(null)

  const empleadosFiltrados = empleadoSeleccionado === 'todos'
    ? empleados
    : empleados.filter(e => e.user_id === empleadoSeleccionado)

  function getTurnosDia(dia: number): Turno[] {
    const dateStr = buildDateStr(year, month, dia)
    return turnos.filter(t =>
      t.fecha === dateStr &&
      (empleadoSeleccionado === 'todos' || t.empleado_id === empleadoSeleccionado)
    )
  }

  function getDiaLibresDia(dia: number): DiaLibre[] {
    const dateStr = buildDateStr(year, month, dia)
    return diasLibres.filter(d =>
      d.fecha === dateStr &&
      (empleadoSeleccionado === 'todos' || d.empleado_id === empleadoSeleccionado)
    )
  }

  function handleClickDia(dia: number) {
    const empId = empleadoSeleccionado === 'todos'
      ? (empleados[0]?.user_id ?? '')
      : empleadoSeleccionado
    setModalDia({
      fecha: buildDateStr(year, month, dia),
      empleadoId: empId,
      tab: 'turno',
    })
  }

  function nombreEmpleado(userId: string): string {
    return empleados.find(e => e.user_id === userId)?.nombre ?? ''
  }

  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Gestión de Personal</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{empleados.length} empleados activos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => cambiarMes(mesAnterior(mes))}
            disabled={cargando}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)] min-w-[140px] text-center">
            {MESES[month]} {year}
          </span>
          <button
            onClick={() => cambiarMes(mesSiguiente(mes))}
            disabled={cargando}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Panel solicitudes pendientes */}
      {solicitudes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-yellow-800 mb-3">
            Solicitudes pendientes ({solicitudes.length})
          </h3>
          <div className="flex flex-col gap-2">
            {solicitudes.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-white rounded-xl border border-yellow-100 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {s.empleado?.nombre ?? s.empleado_id}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatFecha(s.fecha_inicio)} — {formatFecha(s.fecha_fin)}
                    {s.motivo && ` · ${s.motivo}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAprobar(s)}
                    className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => setModalDenegar(s)}
                    className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Denegar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtro empleado */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-[var(--text-muted)]">Empleado:</label>
        <select
          value={empleadoSeleccionado}
          onChange={e => setEmpleadoSeleccionado(e.target.value)}
          className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="todos">Todos</option>
          {empleados.map(e => (
            <option key={e.user_id} value={e.user_id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {/* Calendario */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
        {/* Cabecera días */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-[var(--text-muted)] py-1">{d}</div>
          ))}
        </div>

        {/* Celdas */}
        <div className={`grid grid-cols-7 gap-1 ${cargando ? 'opacity-40 pointer-events-none' : ''}`}>
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={i} />
            const turnosDia = getTurnosDia(dia)
            const diasLibresDia = getDiaLibresDia(dia)
            const dateStr = buildDateStr(year, month, dia)
            const esHoy = dateStr === hoy
            const total = turnosDia.length + diasLibresDia.length
            const maxVisible = 3

            return (
              <div
                key={i}
                onClick={() => handleClickDia(dia)}
                className={`min-h-[72px] rounded-lg p-1 border cursor-pointer transition-colors ${
                  esHoy
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${esHoy ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                  {dia}
                </div>
                <div className="flex flex-col gap-0.5">
                  {turnosDia.slice(0, maxVisible).map(t => {
                    const emp = empleados.find(e => e.user_id === t.empleado_id)
                    return (
                      <span key={t.id} className={`text-[10px] font-medium rounded px-1 leading-4 truncate ${TURNO_COLOR[t.tipo]}`}>
                        {empleadoSeleccionado === 'todos' && emp ? `${iniciales(emp.nombre)} ` : ''}{t.hora_inicio.slice(0, 5)}
                      </span>
                    )
                  })}
                  {diasLibresDia.slice(0, Math.max(0, maxVisible - turnosDia.length)).map(d => {
                    const emp = empleados.find(e => e.user_id === d.empleado_id)
                    return (
                      <span key={d.id} className={`text-[10px] font-medium rounded px-1 leading-4 truncate ${DIA_COLOR[d.tipo]}`}>
                        {empleadoSeleccionado === 'todos' && emp ? `${iniciales(emp.nombre)} ` : ''}{d.tipo}
                      </span>
                    )
                  })}
                  {total > maxVisible && (
                    <span className="text-[10px] text-[var(--text-muted)]">+{total - maxVisible} más</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--border)]">
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><span className="w-3 h-3 rounded bg-green-100 inline-block" /> Turno normal</span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><span className="w-3 h-3 rounded bg-orange-100 inline-block" /> Turno extra</span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><span className="w-3 h-3 rounded bg-purple-100 inline-block" /> Guardia</span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><span className="w-3 h-3 rounded bg-slate-100 inline-block" /> Día libre</span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><span className="w-3 h-3 rounded bg-blue-100 inline-block" /> Festivo</span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Baja</span>
        </div>
      </div>

      {/* Modal gestionar día */}
      {modalDia && (
        <ModalGestionarDia
          fecha={modalDia.fecha}
          empleadoIdInicial={modalDia.empleadoId}
          tabInicial={modalDia.tab}
          empleados={empleados}
          turnoExistente={turnos.find(t => t.fecha === modalDia.fecha && t.empleado_id === modalDia.empleadoId)}
          diaLibreExistente={diasLibres.find(d => d.fecha === modalDia.fecha && d.empleado_id === modalDia.empleadoId)}
          onClose={() => setModalDia(null)}
          onTurnosCreados={(nuevos) => {
            setTurnos(prev => {
              const ids = new Set(nuevos.map(t => t.id))
              return [...prev.filter(x => !ids.has(x.id)), ...nuevos]
            })
            setModalDia(null)
            mostrarToast(
              nuevos.length === 1 ? 'Turno asignado' : `${nuevos.length} turnos asignados`,
              'exito'
            )
          }}
          onTurnoEliminado={(id) => {
            setTurnos(prev => prev.filter(t => t.id !== id))
            setModalDia(null)
            mostrarToast('Turno eliminado', 'exito')
          }}
          onDiaLibreCreado={(d) => {
            setDiasLibres(prev => [...prev.filter(x => x.id !== d.id), d])
            setModalDia(null)
            mostrarToast('Día libre marcado', 'exito')
          }}
          onDiaLibreEliminado={(id) => {
            setDiasLibres(prev => prev.filter(d => d.id !== id))
            setModalDia(null)
            mostrarToast('Día libre eliminado', 'exito')
          }}
          onEmpleadoCambiado={(empId) => {
            setModalDia(prev => prev ? {
              ...prev,
              empleadoId: empId,
            } : null)
          }}
          mostrarToast={mostrarToast}
        />
      )}

      {/* Modal denegar */}
      {modalDenegar && (
        <ModalDenegar
          solicitud={modalDenegar}
          onClose={() => setModalDenegar(null)}
          onConfirmar={handleDenegar}
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

// ── Modal gestionar día ─────────────────────────────────────────────────────

function ModalGestionarDia({
  fecha,
  empleadoIdInicial,
  tabInicial,
  empleados,
  turnoExistente,
  diaLibreExistente,
  onClose,
  onTurnosCreados,
  onTurnoEliminado,
  onDiaLibreCreado,
  onDiaLibreEliminado,
  onEmpleadoCambiado,
  mostrarToast,
}: {
  fecha: string
  empleadoIdInicial: string
  tabInicial: 'turno' | 'diaLibre'
  empleados: EmpleadoResumen[]
  turnoExistente?: Turno
  diaLibreExistente?: DiaLibre
  onClose: () => void
  onTurnosCreados: (turnos: Turno[]) => void
  onTurnoEliminado: (id: string) => void
  onDiaLibreCreado: (d: DiaLibre) => void
  onDiaLibreEliminado: (id: string) => void
  onEmpleadoCambiado: (id: string) => void
  mostrarToast: (msg: string, tipo: 'exito' | 'error') => void
}) {
  const [tab, setTab] = useState<'turno' | 'diaLibre'>(tabInicial)
  const [empleadoId, setEmpleadoId] = useState(empleadoIdInicial)

  // Turno fields
  const [fechaInicio, setFechaInicio] = useState(fecha)
  const [fechaFin, setFechaFin] = useState(fecha)
  const [horaInicio, setHoraInicio] = useState(turnoExistente?.hora_inicio?.slice(0, 5) ?? '09:00')
  const [horaFin, setHoraFin] = useState(turnoExistente?.hora_fin?.slice(0, 5) ?? '17:00')
  const [tipoTurno, setTipoTurno] = useState<TipoTurno>(turnoExistente?.tipo ?? 'normal')
  const [notasTurno, setNotasTurno] = useState(turnoExistente?.notas ?? '')
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null)

  // Día libre fields
  const [tipoDia, setTipoDia] = useState<TipoDiaLibre>(diaLibreExistente?.tipo ?? 'libre')
  const [notasDia, setNotasDia] = useState(diaLibreExistente?.notas ?? '')

  const [guardando, setGuardando] = useState(false)

  const esDiaUnico = fechaInicio === fechaFin
  const diasEnRango = getRangoFechas(fechaInicio, fechaFin <= fechaInicio ? fechaInicio : fechaFin).length

  function handleEmpleadoChange(id: string) {
    setEmpleadoId(id)
    onEmpleadoCambiado(id)
  }

  async function handleSubmitTurno() {
    if (!horaInicio || !horaFin) { mostrarToast('Introduce hora de inicio y fin', 'error'); return }
    if (fechaFin < fechaInicio) { mostrarToast('La fecha fin debe ser igual o posterior a la fecha inicio', 'error'); return }

    setGuardando(true)

    // Modo día único con turno existente → PATCH
    if (esDiaUnico && turnoExistente) {
      try {
        const res = await fetch(`/api/personal/turnos/${turnoExistente.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hora_inicio: horaInicio, hora_fin: horaFin, tipo: tipoTurno, notas: notasTurno.trim() || null }),
        })
        const data = await res.json()
        if (!res.ok) { mostrarToast(data.error ?? 'Error al guardar', 'error'); return }
        onTurnosCreados([data.turno])
      } catch {
        mostrarToast('Error de conexión', 'error')
      } finally {
        setGuardando(false)
        setProgreso(null)
      }
      return
    }

    // Modo rango → POST por cada día
    const fechas = getRangoFechas(fechaInicio, fechaFin)
    const creados: Turno[] = []
    let errores = 0

    for (let i = 0; i < fechas.length; i++) {
      setProgreso({ actual: i + 1, total: fechas.length })
      try {
        const res = await fetch('/api/personal/turnos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empleado_id: empleadoId,
            fecha: fechas[i],
            hora_inicio: horaInicio,
            hora_fin: horaFin,
            tipo: tipoTurno,
            notas: notasTurno.trim() || null,
          }),
        })
        const data = await res.json()
        if (res.ok) creados.push(data.turno)
        else errores++
      } catch {
        errores++
      }
    }

    setGuardando(false)
    setProgreso(null)

    if (creados.length > 0) onTurnosCreados(creados)
    if (errores > 0) mostrarToast(`${errores} día(s) no se pudieron asignar`, 'error')
  }

  async function handleEliminarTurno() {
    if (!turnoExistente) return
    if (!confirm('¿Eliminar este turno?')) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/personal/turnos/${turnoExistente.id}`, { method: 'DELETE' })
      if (!res.ok) { mostrarToast('Error al eliminar', 'error'); return }
      onTurnoEliminado(turnoExistente.id)
    } catch {
      mostrarToast('Error de conexión', 'error')
    } finally {
      setGuardando(false)
    }
  }

  async function handleSubmitDiaLibre() {
    setGuardando(true)
    try {
      const res = await fetch('/api/personal/dias-libres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empleado_id: empleadoId, fecha, tipo: tipoDia, notas: notasDia.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al marcar día libre', 'error'); return }
      onDiaLibreCreado(data.diaLibre)
    } catch {
      mostrarToast('Error de conexión', 'error')
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminarDiaLibre() {
    if (!diaLibreExistente) return
    if (!confirm('¿Eliminar este día libre?')) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/personal/dias-libres/${diaLibreExistente.id}`, { method: 'DELETE' })
      if (!res.ok) { mostrarToast('Error al eliminar', 'error'); return }
      onDiaLibreEliminado(diaLibreExistente.id)
    } catch {
      mostrarToast('Error de conexión', 'error')
    } finally {
      setGuardando(false)
    }
  }

  function textoBotonTurno() {
    if (progreso) return `Asignando ${progreso.actual}/${progreso.total}...`
    if (guardando) return 'Guardando...'
    if (esDiaUnico && turnoExistente) return 'Guardar cambios'
    if (!esDiaUnico) return `Asignar ${diasEnRango} turnos`
    return 'Asignar turno'
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Gestionar turno</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {esDiaUnico ? `${fechaInicio.split('-').reverse().join('/')}` : `${fechaInicio.split('-').reverse().join('/')} → ${fechaFin.split('-').reverse().join('/')}`}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Selector empleado */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Empleado</label>
            <select
              value={empleadoId}
              onChange={e => handleEmpleadoChange(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {empleados.map(e => (
                <option key={e.user_id} value={e.user_id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          {/* Tabs */}
          <div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              onClick={() => setTab('turno')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'turno' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'}`}
            >
              Turno
            </button>
            <button
              onClick={() => setTab('diaLibre')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'diaLibre' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'}`}
            >
              Día libre
            </button>
          </div>

          {tab === 'turno' && (
            <>
              {/* Rango de fechas */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Período</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Desde</span>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={e => {
                        setFechaInicio(e.target.value)
                        if (e.target.value > fechaFin) setFechaFin(e.target.value)
                      }}
                      className="w-full border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Hasta</span>
                    <input
                      type="date"
                      value={fechaFin}
                      min={fechaInicio}
                      onChange={e => setFechaFin(e.target.value)}
                      className="w-full border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
                {!esDiaUnico && (
                  <p className="text-xs text-[var(--primary)] mt-1 font-medium">
                    Se asignarán {diasEnRango} turnos ({diasEnRango} {diasEnRango === 1 ? 'día' : 'días'})
                  </p>
                )}
              </div>

              {/* Horas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Hora inicio</label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={e => setHoraInicio(e.target.value)}
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Hora fin</label>
                  <input
                    type="time"
                    value={horaFin}
                    onChange={e => setHoraFin(e.target.value)}
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Tipo</label>
                <select
                  value={tipoTurno}
                  onChange={e => setTipoTurno(e.target.value as TipoTurno)}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="normal">Normal</option>
                  <option value="extra">Extra</option>
                  <option value="guardia">Guardia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  value={notasTurno}
                  onChange={e => setNotasTurno(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div className="flex gap-2">
                {esDiaUnico && turnoExistente && (
                  <button
                    onClick={handleEliminarTurno}
                    disabled={guardando}
                    className="flex-1 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  onClick={handleSubmitTurno}
                  disabled={guardando}
                  className="flex-1 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors font-medium"
                >
                  {textoBotonTurno()}
                </button>
              </div>
            </>
          )}

          {tab === 'diaLibre' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Tipo</label>
                <select
                  value={tipoDia}
                  onChange={e => setTipoDia(e.target.value as TipoDiaLibre)}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="libre">Día libre</option>
                  <option value="festivo">Festivo</option>
                  <option value="baja">Baja médica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  value={notasDia}
                  onChange={e => setNotasDia(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              <div className="flex gap-2">
                {diaLibreExistente && (
                  <button
                    onClick={handleEliminarDiaLibre}
                    disabled={guardando}
                    className="flex-1 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Eliminar día libre
                  </button>
                )}
                <button
                  onClick={handleSubmitDiaLibre}
                  disabled={guardando}
                  className="flex-1 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {guardando ? 'Guardando...' : diaLibreExistente ? 'Guardar cambios' : 'Marcar día libre'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal denegar ───────────────────────────────────────────────────────────

function ModalDenegar({
  solicitud,
  onClose,
  onConfirmar,
}: {
  solicitud: SolicitudVacacion
  onClose: () => void
  onConfirmar: (s: SolicitudVacacion, comentario: string) => void
}) {
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function handleConfirmar() {
    setGuardando(true)
    await onConfirmar(solicitud, comentario)
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Denegar solicitud</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Denegando solicitud de <span className="font-medium text-[var(--text-primary)]">{solicitud.empleado?.nombre ?? ''}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Motivo de denegación (opcional)</label>
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder="Ej: No hay cobertura para esas fechas"
              rows={3}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </div>
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
            className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Denegando...' : 'Confirmar denegación'}
          </button>
        </div>
      </div>
    </div>
  )
}
