'use client'

import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  planSeleccionado?: string
}

export default function CheckoutModal({ open, onClose, planSeleccionado }: Props) {
  const [nombre, setNombre] = useState('')
  const [nombreRestaurante, setNombreRestaurante] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  if (!open) return null

  async function handleEnviar() {
    setError(null)
    if (!nombre.trim() || !nombreRestaurante.trim() || !email.trim() || !telefono.trim()) {
      setError('Por favor, rellena todos los campos')
      return
    }
    setCargando(true)
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          nombre_restaurante: nombreRestaurante,
          email,
          telefono,
          mensaje: planSeleccionado ? `Plan interesado: ${planSeleccionado}` : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar'); setCargando(false); return }
      window.location.href = '/pago-completado'
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Solicitar información</h2>
          <div onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none cursor-pointer">&times;</div>
        </div>

        {planSeleccionado && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4 text-sm text-amber-800 font-medium">
            {planSeleccionado} seleccionado
          </div>
        )}

        <p className="text-sm text-slate-500 mb-6">Déjanos tus datos y te contactamos para explicarte todo sin compromiso.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del restaurante</label>
            <input
              type="text"
              value={nombreRestaurante}
              onChange={e => setNombreRestaurante(e.target.value)}
              placeholder="Bar / Restaurante"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="+34 600 000 000"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        <button
          onClick={handleEnviar}
          disabled={cargando}
          className="w-full mt-6 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-bold py-4 rounded-2xl text-lg transition-colors"
        >
          {cargando ? 'Enviando...' : 'Quiero que me contacten →'}
        </button>
        <p className="text-xs text-slate-400 text-center mt-3">Sin compromiso. Te respondemos en menos de 24h.</p>
      </div>
    </div>
  )
}
