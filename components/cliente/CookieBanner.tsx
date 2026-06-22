'use client'

import { useEffect, useState } from 'react'

const COOKIE_NAME = 'rp_cookie_consent'
const MAX_AGE = 60 * 60 * 24 * 180 // 180 días

function getConsent(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setConsent(value: 'aceptado' | 'rechazado') {
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`
}

export default function CookieBanner({ slug }: { slug: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (getConsent() === null) setVisible(true)
  }, [])

  function decidir(value: 'aceptado' | 'rechazado') {
    setConsent(value)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', inset: '0 0 0 0', bottom: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 16px', pointerEvents: 'none' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', padding: '16px 20px', width: '100%', maxWidth: 560, pointerEvents: 'all' }}>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, margin: '0 0 12px' }}>
          Usamos cookies técnicas necesarias para el funcionamiento del sitio. No
          usamos cookies de terceros sin tu permiso. Consulta nuestra{' '}
          <a href={`/cliente/${slug}/cookies`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
            política de cookies
          </a>
          .
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => decidir('rechazado')}
            style={{ flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, color: '#374151', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Rechazar no esenciales
          </button>
          <button
            onClick={() => decidir('aceptado')}
            style={{ flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
