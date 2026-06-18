'use client'

import { useState } from 'react'
import {
  PLANES,
  PERIODICIDADES,
  calcularPrecio,
  calcularEquivalenteMensual,
  type Periodicidad,
} from '@/lib/config/landing'

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
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(1)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  if (!open) return null

  const plan = PLANES.find(p => p.nombre === planSeleccionado)
  const total = plan ? calcularPrecio(plan.precio, periodicidad) : null
  const mensual = plan ? calcularEquivalenteMensual(plan.precio, periodicidad) : null
  const descuento = PERIODICIDADES.find(p => p.meses === periodicidad)?.descuento ?? 0

  async function handleEnviar() {
    setError(null)
    if (!nombre.trim() || !nombreRestaurante.trim() || !email.trim() || !telefono.trim()) {
      setError('Por favor, rellena todos los campos.')
      return
    }
    if (!plan) {
      setError('No se ha podido identificar el plan seleccionado.')
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
          plan_id: plan.id,
          periodicidad,
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

        {/* Selector de periodicidad */}
        <div className="mb-6">
          <p className={labelClass}>Periodicidad de pago</p>
          <div className="grid grid-cols-3 gap-2">
            {PERIODICIDADES.map(({ meses, descuento: d }) => (
              <div
                key={meses}
                onClick={() => setPeriodicidad(meses)}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center transition-colors ${
                  periodicidad === meses
                    ? 'border-[#1E4080] bg-[#1E4080]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold ${periodicidad === meses ? 'text-[#1E4080]' : 'text-[#1A2B4A]'}`}>
                  {meses === 1 ? 'Mensual' : `${meses} meses`}
                </p>
                {d > 0 && (
                  <p className="text-xs text-[#B8860B] font-medium mt-0.5">
                    -{Math.round(d * 100)}%
                  </p>
                )}
              </div>
            ))}
          </div>

          {plan && total !== null && mensual !== null && (
            <div className="mt-3 rounded-lg bg-[#F7F6F3] px-4 py-3 text-sm">
              {periodicidad === 1 ? (
                <p className="text-[#1A2B4A] font-semibold">{total.toFixed(2).replace('.', ',')}€/mes</p>
              ) : (
                <>
                  <p className="text-[#1A2B4A] font-semibold">
                    {total.toFixed(2).replace('.', ',')}€ cada {periodicidad} meses
                  </p>
                  <p className="text-gray-500 mt-0.5">
                    ({mensual.toFixed(2).replace('.', ',')}€/mes — ahorras un {Math.round(descuento * 100)}%)
                  </p>
                </>
              )}
            </div>
          )}
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
