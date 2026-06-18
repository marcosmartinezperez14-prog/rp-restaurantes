'use client'

import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  planSeleccionado?: string
}

type Estado = 'idle' | 'enviando' | 'ok' | 'error'

export default function ContactarVentasModal({ open, onClose, planSeleccionado }: Props) {
  const [nombre, setNombre] = useState('')
  const [restaurante, setRestaurante] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!open) return null

  async function handleEnviar() {
    setErrorMsg(null)
    if (!nombre.trim() || !restaurante.trim() || !email.trim() || !telefono.trim()) {
      setErrorMsg('Nombre, restaurante, correo y teléfono son obligatorios.')
      return
    }
    setEstado('enviando')
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          nombre_restaurante: restaurante.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
          mensaje: [planSeleccionado ? `Plan de interés: ${planSeleccionado}` : '', mensaje.trim()]
            .filter(Boolean).join('\n') || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'No se pudo enviar. Inténtalo de nuevo.')
        setEstado('error')
        return
      }
      setEstado('ok')
    } catch {
      setErrorMsg('Error de conexión. Inténtalo de nuevo.')
      setEstado('error')
    }
  }

  function handleClose() {
    onClose()
    // reset tras la animación de cierre
    setTimeout(() => {
      setNombre(''); setRestaurante(''); setEmail('')
      setTelefono(''); setMensaje('')
      setEstado('idle'); setErrorMsg(null)
    }, 200)
  }

  const inp: React.CSSProperties = {
    width: '100%', border: '1.5px solid #E1E5F0', borderRadius: 10,
    padding: '12px 14px', fontSize: 14, color: '#0B1020',
    fontFamily: 'var(--font-plus-jakarta)', outline: 'none',
    transition: 'border-color .15s',
    background: '#fff', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#46506A', marginBottom: 6,
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px', background: 'rgba(11,16,32,0.55)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20,
          padding: 36, width: '100%', maxWidth: 480,
          boxShadow: '0 32px 80px rgba(11,16,32,0.2)',
          fontFamily: 'var(--font-plus-jakarta)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
              Habla con ventas
            </h2>
            {planSeleccionado ? (
              <span style={{
                display: 'inline-block', background: '#E8EDFF', color: '#2F54EB',
                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
              }}>
                {planSeleccionado}
              </span>
            ) : (
              <p style={{ fontSize: 14, color: '#5B6477', margin: 0 }}>
                Te respondemos en menos de 24 horas.
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{
              background: '#F6F7FB', border: 'none', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', fontSize: 18,
              color: '#46506A', flexShrink: 0, marginLeft: 12,
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {estado === 'ok' ? (
          /* Estado de éxito */
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#E8EDFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24,
            }}>
              ✓
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>¡Recibido!</h3>
            <p style={{ fontSize: 15, color: '#5B6477', margin: '0 0 24px' }}>
              Nos pondremos en contacto contigo en menos de 24 horas.
            </p>
            <button
              onClick={handleClose}
              style={{
                background: '#2F54EB', color: '#fff', border: 'none',
                padding: '12px 28px', borderRadius: 10, fontFamily: 'inherit',
                fontWeight: 600, fontSize: 15, cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        ) : (
          /* Formulario */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Nombre *</label>
                <input
                  type="text" value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = '#2F54EB')}
                  onBlur={e => (e.target.style.borderColor = '#E1E5F0')}
                />
              </div>
              <div>
                <label style={lbl}>Restaurante *</label>
                <input
                  type="text" value={restaurante}
                  onChange={e => setRestaurante(e.target.value)}
                  placeholder="Nombre del negocio"
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = '#2F54EB')}
                  onBlur={e => (e.target.style.borderColor = '#E1E5F0')}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Correo electrónico *</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = '#2F54EB')}
                  onBlur={e => (e.target.style.borderColor = '#E1E5F0')}
                />
              </div>
              <div>
                <label style={lbl}>Teléfono *</label>
                <input
                  type="tel" value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="+34 600 000 000"
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = '#2F54EB')}
                  onBlur={e => (e.target.style.borderColor = '#E1E5F0')}
                />
              </div>
            </div>
            <div>
              <label style={lbl}>Mensaje (opcional)</label>
              <textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                rows={3}
                placeholder="Cuéntanos sobre tu negocio o tus dudas..."
                style={{ ...inp, resize: 'none' }}
                onFocus={e => (e.target.style.borderColor = '#2F54EB')}
                onBlur={e => (e.target.style.borderColor = '#E1E5F0')}
              />
            </div>

            {errorMsg && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 10, padding: '12px 14px',
                fontSize: 13, color: '#DC2626',
              }}>
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleEnviar}
              disabled={estado === 'enviando'}
              style={{
                background: estado === 'enviando' ? '#93AEFF' : '#2F54EB',
                color: '#fff', border: 'none', padding: '14px',
                borderRadius: 11, fontFamily: 'inherit', fontWeight: 700,
                fontSize: 15, cursor: estado === 'enviando' ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 20px rgba(47,84,235,0.28)',
                transition: 'background .15s',
              }}
            >
              {estado === 'enviando' ? 'Enviando...' : 'Enviar mensaje'}
            </button>
            <p style={{ fontSize: 12, color: '#8A93A6', textAlign: 'center', margin: 0 }}>
              Sin compromiso · Respondemos en menos de 24 horas
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
