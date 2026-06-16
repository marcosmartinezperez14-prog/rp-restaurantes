'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

// No re-suscribimos a cambios externos: el consentimiento solo cambia desde
// este componente (vía estado local). subscribe es un noop.
const noopSubscribe = () => () => {}

const COOKIE_NAME = 'rp_cookie_consent'
const MAX_AGE = 60 * 60 * 24 * 180 // 180 días

function getConsent(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setConsent(value: 'aceptado' | 'rechazado') {
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`
}

// Hook preparado para activar analítica SOLO tras aceptación. Vacío a propósito:
// actualmente no hay cookies de terceros. No añadir scripts aquí sin revisión.
function activarAnaliticaSiProcede(consent: string | null) {
  if (consent !== 'aceptado') return
  // TODO: inicializar analítica de terceros cuando exista.
}

export default function CookieBanner({ slug }: { slug: string }) {
  // Consentimiento ya guardado en cookie. En el servidor devuelve null
  // (snapshot de servidor), evitando desajustes de hidratación; en cliente lee
  // la cookie real tras montar.
  const consentGuardado = useSyncExternalStore(noopSubscribe, getConsent, () => null)

  // Decisión tomada en esta sesión (tiene prioridad para ocultar el banner).
  const [decidido, setDecidido] = useState(false)

  // Activa la analítica si ya había aceptación previa al cargar.
  useEffect(() => {
    activarAnaliticaSiProcede(consentGuardado)
  }, [consentGuardado])

  function decidir(value: 'aceptado' | 'rechazado') {
    setConsent(value)
    activarAnaliticaSiProcede(value)
    setDecidido(true)
  }

  // Mostrar solo si no hay consentimiento previo y no se ha decidido aún.
  const visible = consentGuardado === null && !decidido
  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-lg p-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          Usamos cookies técnicas necesarias para el funcionamiento del sitio. No
          usamos cookies de terceros sin tu permiso. Consulta nuestra{' '}
          <a href={`/cliente/${slug}/cookies`} className="text-blue-600 underline">
            política de cookies
          </a>
          .
        </p>
        <div className="flex gap-3 mt-3">
          <button
            onClick={() => decidir('rechazado')}
            className="flex-1 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Rechazar no esenciales
          </button>
          <button
            onClick={() => decidir('aceptado')}
            className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
