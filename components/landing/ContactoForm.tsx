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
      setErrorMsg('Nombre, email y teléfono son obligatorios')
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
      if (!res.ok) { setErrorMsg(data.error ?? 'Error al enviar'); setEstado('error'); return }
      setEstado('ok')
    } catch {
      setErrorMsg('Error de conexión. Inténtalo de nuevo.')
      setEstado('error')
    }
  }

  if (estado === 'ok') {
    return (
      <div className="max-w-xl mx-auto text-center py-10">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">¡Mensaje recibido!</h3>
        <p className="text-slate-500">Nos pondremos en contacto contigo en menos de 24 horas.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Restaurante</label>
          <input type="text" value={nombreRestaurante} onChange={e => setNombreRestaurante(e.target.value)} placeholder="Nombre del negocio"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono *</label>
          <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+34 600 000 000"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Mensaje (opcional)</label>
        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={4} placeholder="Cuéntanos sobre tu negocio..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
      </div>
      {errorMsg && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMsg}</p>}
      <button onClick={handleEnviar} disabled={estado === 'enviando'}
        className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-bold py-4 rounded-2xl text-lg transition-colors">
        {estado === 'enviando' ? 'Enviando...' : 'Solicitar demo gratuita'}
      </button>
    </div>
  )
}
