'use client'

import { useState } from 'react'

export default function ContactoForm() {
  const [nombre, setNombre] = useState('')
  const [nombreRestaurante, setNombreRestaurante] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleEnviar() {
    setErrorMsg(null)
    if (!nombre.trim() || !email.trim() || !telefono.trim()) {
      setErrorMsg('Nombre, correo electrónico y teléfono son obligatorios.')
      return
    }
    setEstado('enviando')
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, nombre_restaurante: nombreRestaurante, email, telefono, mensaje: mensaje || null }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Error al enviar.'); setEstado('error'); return }
      setEstado('ok')
    } catch {
      setErrorMsg('Error de conexión. Inténtalo de nuevo.')
      setEstado('error')
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#1E4080] focus:border-[#1E4080] transition-colors"
  const labelClass = "block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide"

  if (estado === 'ok') {
    return (
      <div className="max-w-xl mx-auto text-center py-12" style={{ fontFamily: 'var(--font-inter)' }}>
        <div className="w-12 h-12 rounded-full bg-[#1E4080] flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-lg font-semibold">✓</span>
        </div>
        <h3 className="text-xl font-semibold text-[#1A2B4A] mb-2" style={{ fontFamily: 'var(--font-lora)' }}>
          Mensaje recibido
        </h3>
        <p className="text-gray-500 text-sm leading-relaxed">
          Nos pondremos en contacto contigo en menos de 24 horas.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-4" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Nombre *</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Restaurante o bar</label>
          <input type="text" value={nombreRestaurante} onChange={e => setNombreRestaurante(e.target.value)} placeholder="Nombre del negocio" className={inputClass} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Correo electrónico *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Teléfono *</label>
          <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+34 600 000 000" className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Mensaje (opcional)</label>
        <textarea
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          rows={4}
          placeholder="Cuéntanos sobre tu negocio o las dudas que tengas..."
          className={`${inputClass} resize-none`}
        />
      </div>
      {errorMsg && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{errorMsg}</p>
      )}
      <button
        onClick={handleEnviar}
        disabled={estado === 'enviando'}
        className="w-full bg-[#1E4080] hover:bg-[#163260] disabled:opacity-50 text-white font-semibold py-3.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E4080] focus:ring-offset-2"
      >
        {estado === 'enviando' ? 'Enviando...' : 'Solicitar demo gratuita'}
      </button>
      <p className="text-xs text-gray-400 text-center pt-1">Sin compromiso. Respondemos en menos de 24 horas.</p>
    </div>
  )
}
