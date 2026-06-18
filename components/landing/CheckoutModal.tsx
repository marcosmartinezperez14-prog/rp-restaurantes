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
      setError('Por favor, rellena todos los campos.')
      return
    }
    setCargando(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          nombre_restaurante: nombreRestaurante,
          email,
          telefono,
          plan_interes: planSeleccionado ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo preparar el pago. Inténtalo de nuevo.'); setCargando(false); return }
      window.location.href = data.url
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setCargando(false)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#1E4080] focus:border-[#1E4080] transition-colors"
  const labelClass = "block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2
              className="text-xl font-semibold text-[#1A2B4A]"
              style={{ fontFamily: 'var(--font-lora)' }}
            >
              Continuar al pago
            </h2>
            {planSeleccionado && (
              <p className="text-sm text-[#1E4080] mt-1 font-medium">{planSeleccionado}</p>
            )}
          </div>
          <div
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer ml-4 mt-0.5"
            aria-label="Cerrar"
          >
            &times;
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Necesitamos tus datos para asociar el pago a tu negocio. Te redirigiremos a la pasarela de pago segura en el siguiente paso.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Nombre del restaurante o bar</label>
            <input
              type="text"
              value={nombreRestaurante}
              onChange={e => setNombreRestaurante(e.target.value)}
              placeholder="El nombre de tu negocio"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="+34 600 000 000"
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          onClick={handleEnviar}
          disabled={cargando}
          className="w-full mt-6 bg-[#1E4080] hover:bg-[#163260] disabled:opacity-50 text-white font-semibold py-3.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E4080] focus:ring-offset-2"
        >
          {cargando ? 'Preparando pago...' : 'Continuar al pago'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          Pago seguro procesado por Stripe. Tus datos están protegidos.
        </p>
      </div>
    </div>
  )
}
