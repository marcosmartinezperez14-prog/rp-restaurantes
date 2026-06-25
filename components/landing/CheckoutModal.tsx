'use client'

import { useState } from 'react'
import { PLANES, PERIODICIDADES, calcularPrecio, calcularEquivalenteMensual } from '@/lib/config/landing'

interface Props {
  open: boolean
  onClose: () => void
  planSeleccionado?: string
}

const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#2F54EB] focus:border-[#2F54EB] transition-colors"
const labelClass = "block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide"

export default function CheckoutModal({ open, onClose, planSeleccionado }: Props) {
  const [nombre, setNombre] = useState('')
  const [nombreRestaurante, setNombreRestaurante] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [periodicidad, setPeriodicidad] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  if (!open) return null

  const plan = planSeleccionado ? PLANES.find(p => p.id === planSeleccionado) : null
  const modoContratacion = !!plan

  const totalEuros = plan ? calcularPrecio(plan.precio, periodicidad as 1 | 6 | 12) : 0
  const mensualEuros = plan ? calcularEquivalenteMensual(plan.precio, periodicidad as 1 | 6 | 12) : 0

  async function handleEnviar() {
    setError(null)
    if (!nombre.trim() || !nombreRestaurante.trim() || !email.trim() || !telefono.trim()) {
      setError('Por favor, rellena todos los campos.')
      return
    }
    setCargando(true)
    try {
      if (modoContratacion) {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre,
            nombre_restaurante: nombreRestaurante,
            email,
            telefono,
            plan_id: planSeleccionado,
            periodicidad,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'No se pudo iniciar el pago. Inténtalo de nuevo.'); setCargando(false); return }
        window.location.href = data.url
      } else {
        const res = await fetch('/api/contacto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre,
            nombre_restaurante: nombreRestaurante,
            email,
            telefono,
            mensaje: null,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'No se pudo enviar. Inténtalo de nuevo.'); setCargando(false); return }
        setEnviado(true)
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: 'var(--font-plus-jakarta)' }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#0B1020]">
              {modoContratacion ? `Contratar ${plan!.nombre}` : 'Contactar con ventas'}
            </h2>
            <p className="text-sm text-[#5B6477] mt-1">
              {modoContratacion
                ? 'Completa tus datos y te llevamos al pago seguro.'
                : 'Te llamamos o escribimos en menos de 24h.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer ml-4 mt-0.5 border-none bg-transparent"
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>

        {enviado ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✓</div>
            <h3 className="text-lg font-bold text-[#0B1020] mb-2">¡Mensaje recibido!</h3>
            <p className="text-sm text-[#5B6477]">Nos pondremos en contacto contigo en menos de 24h.</p>
            <button
              onClick={onClose}
              className="mt-6 bg-[#2F54EB] text-white font-semibold py-3 px-8 rounded-xl text-sm"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {modoContratacion && (
              <div className="mb-5">
                <label className={labelClass}>Periodicidad de facturación</label>
                <div className="flex gap-2">
                  {PERIODICIDADES.map(p => {
                    const mensual = calcularEquivalenteMensual(plan!.precio, p.meses as 1 | 6 | 12)
                    const activo = periodicidad === p.meses
                    return (
                      <button
                        key={p.meses}
                        type="button"
                        onClick={() => setPeriodicidad(p.meses)}
                        className={`flex-1 rounded-lg border py-2 px-1 text-xs font-semibold transition-colors cursor-pointer ${
                          activo
                            ? 'border-[#2F54EB] bg-[#EEF2FF] text-[#2F54EB]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div>{p.meses === 1 ? 'Mensual' : p.meses === 6 ? '6 meses' : 'Anual'}</div>
                        <div className="font-bold mt-0.5">{mensual}€/mes</div>
                        {p.descuento > 0 && (
                          <div className="text-green-600 text-[10px]">-{p.descuento * 100}%</div>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2 text-right">
                  Total a cobrar: <strong className="text-gray-600">{totalEuros}€</strong>
                  {periodicidad > 1 && ` cada ${periodicidad} meses`}
                </p>
              </div>
            )}

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
              className="w-full mt-6 bg-[#2F54EB] hover:bg-[#2545c9] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors"
            >
              {cargando
                ? (modoContratacion ? 'Preparando pago...' : 'Enviando...')
                : (modoContratacion ? `Ir al pago — ${totalEuros}€` : 'Enviar mensaje')}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              {modoContratacion ? 'Pago seguro con Stripe · Sin permanencia' : 'Sin permanencia · Sin compromiso'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
