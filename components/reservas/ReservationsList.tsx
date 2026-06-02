'use client'

import { useState, useTransition } from 'react'
import type { Reservation, ReservationStatus, ZoneOption } from '@/app/actions/reservas'
import { getReservationsByDate, updateReservationStatus, deleteReservation } from '@/app/actions/reservas'
import NewReservationModal from './NewReservationModal'

const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string }> = {
  confirmed: { label: 'Confirmada',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  seated:    { label: 'Sentada',       color: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Completada',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelada',     color: 'bg-red-50 text-red-600 border-red-200' },
  no_show:   { label: 'No presentado', color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const NEXT_STATUSES: Record<ReservationStatus, ReservationStatus[]> = {
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated:    ['completed', 'cancelled'],
  completed: [],
  cancelled: ['confirmed'],
  no_show:   ['confirmed'],
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: 'Confirmada',
  seated:    'Sentar',
  completed: 'Completar',
  cancelled: 'Cancelar',
  no_show:   'No presentado',
}

interface Props {
  initialReservations: Reservation[]
  zones: ZoneOption[]
  initialDate: string
}

export default function ReservationsList({ initialReservations, zones, initialDate }: Props) {
  const [reservations, setReservations] = useState(initialReservations)
  const [date, setDate] = useState(initialDate)
  const [showNew, setShowNew] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function loadDate(d: string) {
    setDate(d)
    startTransition(async () => {
      const data = await getReservationsByDate(d)
      setReservations(data)
    })
  }

  function handleStatusChange(id: string, status: ReservationStatus) {
    setError(null)
    startTransition(async () => {
      const res = await updateReservationStatus(id, status)
      if (res.error) { setError(res.error); return }
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta reserva?')) return
    startTransition(async () => {
      const res = await deleteReservation(id)
      if (res.error) { setError(res.error); return }
      setReservations(prev => prev.filter(r => r.id !== id))
    })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={e => loadDate(e.target.value)}
          className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        {date !== todayStr && (
          <button onClick={() => loadDate(todayStr)}
            className="px-3 py-2 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200">
            Hoy
          </button>
        )}
        <span className="text-sm text-[#64748b]">
          {reservations.length} reserva{reservations.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
        >
          + Nueva reserva
        </button>
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 ml-4 font-bold">x</button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {reservations.length === 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-xl px-6 py-10 text-center text-sm text-[#94a3b8]">
            No hay reservas para este día
          </div>
        )}
        {reservations.map(r => {
          const cfg = STATUS_CONFIG[r.status]
          const nextStatuses = NEXT_STATUSES[r.status]
          return (
            <div key={r.id} className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 flex items-start gap-3 flex-wrap">
              <div className="text-[18px] font-black text-[#0f172a] w-14 flex-shrink-0 pt-0.5">
                {r.reservation_time.slice(0, 5)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#0f172a]">{r.customer_name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[#64748b] flex-wrap">
                  <span>{r.customer_phone}</span>
                  <span>{r.party_size} pers.</span>
                  {r.table_name && <span>{r.table_name}</span>}
                  {r.customer_email && <span>{r.customer_email}</span>}
                </div>
                {r.notes && (
                  <p className="text-xs text-[#94a3b8] mt-0.5 italic">{r.notes}</p>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap flex-shrink-0">
                {nextStatuses.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(r.id, s)}
                    disabled={isPending}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border disabled:opacity-50 transition-colors ${STATUS_CONFIG[s].color} hover:opacity-80`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
                {r.status !== 'completed' && r.status !== 'seated' && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={isPending}
                    className="px-2.5 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 disabled:opacity-50"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showNew && (
        <NewReservationModal
          zones={zones}
          defaultDate={date}
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            const fresh = await getReservationsByDate(date)
            setReservations(fresh)
          }}
        />
      )}
    </div>
  )
}
