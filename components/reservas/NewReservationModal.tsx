'use client'

import { useState, useTransition } from 'react'
import type { ZoneOption } from '@/app/actions/reservas'
import { createReservation } from '@/app/actions/reservas'

interface Props {
  zones: ZoneOption[]
  defaultDate: string
  onClose: () => void
  onSaved: () => void
}

export default function NewReservationModal({ zones, defaultDate, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('13:00')
  const [zoneId, setZoneId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const size = parseInt(partySize)
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (!phone.trim()) { setError('El teléfono es obligatorio'); return }
    if (isNaN(size) || size < 1) { setError('Número de comensales inválido'); return }

    setError(null)
    startTransition(async () => {
      const res = await createReservation({
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
        partySize: size,
        date,
        time,
        zoneId: zoneId || undefined,
        notes: notes || undefined,
      })
      if ('error' in res) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex-shrink-0">
          <h2 className="font-bold text-[#0f172a]">Nueva reserva</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs font-medium text-[#64748b]">Nombre *</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Teléfono *</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="600 000 000" type="tel"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Email</span>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" type="email"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Comensales *</span>
              <input value={partySize} onChange={e => setPartySize(e.target.value)} type="number" min="1"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Zona</span>
              <select value={zoneId} onChange={e => setZoneId(e.target.value)}
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 bg-white">
                <option value="">Sin preferencia</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Fecha *</span>
              <input value={date} onChange={e => setDate(e.target.value)} type="date"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Hora *</span>
              <input value={time} onChange={e => setTime(e.target.value)} type="time"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Notas</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Alergias, preferencias de mesa..."
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 resize-none" />
          </label>
          {zoneId && (
            <p className="text-xs text-[#64748b]">
              Se asignará automáticamente la mesa más adecuada para {partySize || '?'} comensales en esa zona.
            </p>
          )}
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}
