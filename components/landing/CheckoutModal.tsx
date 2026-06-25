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
  const [enviado, setEnviado] = useState(false)

  if (!open) return null

  async function handleEnviar() {
    setError(null)
    if (!nombre.trim() || !nombreRestaurante.trim() || !email.trim() || !telefono.trim()) {
      setError('Por favor, rellena todos los campos.')
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
          mensaje: planSeleccionado ? `Plan de interés: ${planSeleccionado}` : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo enviar. Inténtalo de nuevo.'); setCargando(false); return }
      setEnviado(true)
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#2F54EB] focus:border-[#2F54EB] transition-colors"
  const labelClass = "block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide"

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
            <h2 className="text-xl font-bold text-[#0B1020]">Contactar con ventas</h2>
            <p className="text-sm text-[#5B6477] mt-1">Te llamamos o escribimos en menos de 24h.</p>
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
              {cargando ? 'Enviando...' : 'Enviar mensaje'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Sin permanencia · Sin compromiso
            </p>
          </>
        )}
      </div>
    </div>
  )
}
