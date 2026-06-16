// Tipos para las páginas legales (RGPD) de la zona pública.

export type LegalTipo = 'privacidad' | 'aviso_legal' | 'cookies'

export interface LegalPage {
  id: string
  restaurant_id: string
  tipo: LegalTipo
  contenido: string // markdown
  updated_at: string
}

// Versión del texto de consentimiento mostrado al cliente al reservar.
// Si cambia el texto del checkbox, incrementa esta versión.
export const CONSENTIMIENTO_TEXTO_VERSION = 'v1'

// Campos añadidos a la tabla `reservations` para el registro de consentimiento.
export interface ReservaConsentimiento {
  consentimiento_rgpd: boolean
  consentimiento_timestamp: string | null
  consentimiento_texto_version: string | null
}

export const LEGAL_RUTA: Record<LegalTipo, string> = {
  privacidad: 'privacidad',
  aviso_legal: 'aviso-legal',
  cookies: 'cookies',
}

export const LEGAL_TITULO: Record<LegalTipo, string> = {
  privacidad: 'Política de privacidad',
  aviso_legal: 'Aviso legal',
  cookies: 'Política de cookies',
}
