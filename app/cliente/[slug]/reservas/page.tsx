'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function ReservasPage() {
  const params = useParams()
  const slug = params.slug as string

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [numPersonas, setNumPersonas] = useState(2)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [autoConfirm, setAutoConfirm] = useState(true)

  const hoy = new Date().toISOString().split('T')[0]

  async function handleEnviar() {
    setError(null)
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!telefono.trim()) { setError('El teléfono es obligatorio'); return }
    if (!fecha) { setError('La fecha es obligatoria'); return }
    if (!hora) { setError('La hora es obligatoria'); return }
    if (numPersonas < 1) { setError('El número de personas debe ser al menos 1'); return }

    setEnviando(true)
    try {
      const res = await fetch(`/api/cliente/${slug}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_cliente: nombre,
          telefono,
          fecha,
          hora,
          num_personas: numPersonas,
          notas: notas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo realizar la reserva'); return }
      setAutoConfirm(data.auto_confirm !== false)
      setEnviado(true)
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">{autoConfirm ? '✓' : '🕐'}</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {autoConfirm ? '¡Reserva confirmada!' : 'Reserva recibida'}
        </h2>
        <p className="text-gray-500 text-sm">
          {autoConfirm
            ? <>{`Te esperamos el ${fecha.split('-').reverse().join('/')} a las ${hora}h.`}<br />Nos pondremos en contacto si necesitamos confirmar.</>
            : 'Te confirmaremos lo antes posible.'}
        </p>
        <a
          href={`/cliente/${slug}`}
          className="inline-block mt-6 px-4 py-2 text-sm text-blue-600 underline"
        >
          Ver la carta
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/cliente/${slug}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          ←
        </a>
        <h1 className="text-xl font-bold text-gray-900">Reservar mesa</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre completo"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            type="tel"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="600 000 000"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              min={hoy}
              onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de personas</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setNumPersonas(p => Math.max(1, p - 1))}
              className="w-10 h-10 rounded-full border border-gray-300 text-gray-700 text-lg font-bold flex items-center justify-center hover:bg-gray-50"
            >
              −
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[2rem] text-center">
              {numPersonas}
            </span>
            <button
              onClick={() => setNumPersonas(p => p + 1)}
              className="w-10 h-10 rounded-full border border-gray-300 text-gray-700 text-lg font-bold flex items-center justify-center hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Alergias, cumpleaños, preferencias..."
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleEnviar}
          disabled={enviando}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {enviando ? 'Enviando...' : 'Confirmar reserva'}
        </button>
      </div>
    </div>
  )
}
