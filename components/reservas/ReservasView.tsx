'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Reserva } from '@/types/reservas'

interface Props {
  reservas: Reserva[]
}

type FiltroEstado = 'all' | 'pending' | 'confirmed' | 'cancelled'

const ESTADO_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

const ESTADO_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

function hoyISO() {
  return new Intl.DateTimeFormat('sv').format(new Date())
}

export default function ReservasView({ reservas: reservasIniciales }: Props) {
  const [reservas, setReservas] = useState<Reserva[]>(reservasIniciales)
  const [filtroFecha, setFiltroFecha] = useState(hoyISO())
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('all')
  const [modalEditar, setModalEditar] = useState<Reserva | null>(null)
  const [cargando, setCargando] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [editFecha, setEditFecha] = useState('')
  const [editHora, setEditHora] = useState('')
  const [editPersonas, setEditPersonas] = useState(1)
  const [editNotas, setEditNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  useEffect(() => {
    setReservas(reservasIniciales)
  }, [reservasIniciales])

  const reservasFiltradas = useMemo(() => {
    return reservas
      .filter(r => r.reservation_date === filtroFecha)
      .filter(r => filtroEstado === 'all' || r.status === filtroEstado)
      .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
  }, [reservas, filtroFecha, filtroEstado])

  function abrirModal(r: Reserva) {
    setModalEditar(r)
    setEditFecha(r.reservation_date)
    setEditHora(r.reservation_time)
    setEditPersonas(r.party_size)
    setEditNotas(r.notes ?? '')
    setErrorModal(null)
  }

  async function cambiarEstado(id: string, status: Reserva['status']) {
    setErrorMsg(null)
    setCargando(id)
    const prevStatus = reservas.find(r => r.id === id)?.status
    setReservas(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    try {
      const res = await fetch(`/api/reservas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json()
        setReservas(prev => prev.map(r => r.id === id ? { ...r, status: prevStatus ?? r.status } : r))
        setErrorMsg(data.error ?? 'Error al actualizar')
      }
    } catch {
      setReservas(prev => prev.map(r => r.id === id ? { ...r, status: prevStatus ?? r.status } : r))
      setErrorMsg('Error de conexión')
    } finally {
      setCargando(null)
    }
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la reserva de ${nombre}? Esta acción no se puede deshacer.`)) return
    setErrorMsg(null)
    setCargando(id)
    try {
      const res = await fetch(`/api/reservas/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReservas(prev => prev.filter(r => r.id !== id))
      } else {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Error al eliminar')
      }
    } catch {
      setErrorMsg('Error de conexión')
    } finally {
      setCargando(null)
    }
  }

  async function guardarEdicion() {
    if (!modalEditar) return
    setErrorModal(null)
    setGuardando(true)
    try {
      const res = await fetch(`/api/reservas/${modalEditar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_date: editFecha,
          reservation_time: editHora,
          party_size: editPersonas,
          notes: editNotas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorModal(data.error ?? 'Error al guardar'); return }
      setReservas(prev => prev.map(r => r.id === modalEditar.id ? data.data : r))
      setModalEditar(null)
    } catch {
      setErrorModal('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {errorMsg && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs underline">Cerrar</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-secondary)] font-medium">Fecha</label>
          <input
            type="date"
            value={filtroFecha}
            onChange={e => setFiltroFecha(e.target.value)}
            className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-secondary)] font-medium">Estado</label>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}
            className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="confirmed">Confirmadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
        <div className="ml-auto text-xs text-[var(--text-secondary)] self-end pb-2">
          {reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {reservasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)] text-sm">
          No hay reservas para los filtros seleccionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-surface)] border-b border-[var(--border)]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Hora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Personas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Notas</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {reservasFiltradas.map(r => (
                <tr key={r.id} className="bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{r.reservation_time.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    <div>{r.customer_name}</div>
                    {r.customer_email && <div className="text-xs text-[var(--text-secondary)]">{r.customer_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.customer_phone}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)] text-center">{r.party_size}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[r.status] ?? ''}`}>
                      {ESTADO_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] max-w-[200px] truncate">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {r.status === 'pending' && (
                        <button
                          onClick={() => cambiarEstado(r.id, 'confirmed')}
                          disabled={cargando === r.id}
                          title="Confirmar"
                          className="text-green-600 hover:text-green-800 disabled:opacity-40 font-medium text-xs px-2 py-1 rounded border border-green-200 hover:bg-green-50 transition-colors"
                        >
                          Confirmar
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'confirmed') && (
                        <button
                          onClick={() => cambiarEstado(r.id, 'cancelled')}
                          disabled={cargando === r.id}
                          title="Cancelar"
                          className="text-red-500 hover:text-red-700 disabled:opacity-40 font-medium text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => abrirModal(r)}
                        disabled={cargando === r.id}
                        title="Editar"
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 p-1 rounded hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => eliminar(r.id, r.customer_name)}
                        disabled={cargando === r.id}
                        title="Eliminar"
                        className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1 rounded hover:bg-red-50 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
          onClick={() => setModalEditar(null)}
        >
          <div
            className="bg-[var(--bg-surface)] rounded-xl shadow-2xl p-6 w-full max-w-md border border-[var(--border)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Editar reserva</h3>
              <button
                onClick={() => setModalEditar(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-sm">
              <p className="font-medium text-[var(--text-primary)]">{modalEditar.customer_name}</p>
              <p className="text-[var(--text-secondary)]">{modalEditar.customer_phone}</p>
              {modalEditar.customer_email && <p className="text-[var(--text-secondary)]">{modalEditar.customer_email}</p>}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Fecha</label>
                  <input
                    type="date"
                    value={editFecha}
                    onChange={e => setEditFecha(e.target.value)}
                    className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Hora</label>
                  <input
                    type="time"
                    value={editHora}
                    onChange={e => setEditHora(e.target.value)}
                    className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Número de personas</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editPersonas}
                  onChange={e => setEditPersonas(Number(e.target.value))}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Notas</label>
                <textarea
                  value={editNotas}
                  onChange={e => setEditNotas(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                />
              </div>
            </div>

            {errorModal && (
              <p className="text-xs text-red-500 mt-3">{errorModal}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setModalEditar(null)}
                className="flex-1 px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={guardando}
                className="flex-1 px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
