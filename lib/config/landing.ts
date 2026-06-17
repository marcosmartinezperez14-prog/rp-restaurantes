export const STRIPE_PAYMENT_LINK = process.env.STRIPE_PAYMENT_LINK ?? ''
export const CONTACTO_EMAIL = 'hola@rp-restaurantes.com'

export const PLANES = [
  {
    id: 'basico',
    nombre: 'Plan Básico',
    precio: 47,
    descripcion: 'Mantenimiento y actualizaciones del sistema.',
    features: [
      'TPV táctil ilimitado',
      'Carta digital con QR',
      'Gestión de reservas con RGPD',
      'Facturación Verifactu automática',
      'Informes y cierre de caja',
      'Actualizaciones incluidas',
    ],
    destacado: false,
  },
  {
    id: 'estandar',
    nombre: 'Plan Estándar',
    precio: 72,
    descripcion: 'Todo lo del Básico más gestión de incidencias por ticket.',
    features: [
      'TPV táctil ilimitado',
      'Carta digital con QR',
      'Gestión de reservas con RGPD',
      'Facturación Verifactu automática',
      'Informes y cierre de caja',
      'Actualizaciones incluidas',
      'Soporte por ticket (sin SLA)',
    ],
    destacado: false,
  },
  {
    id: 'premium',
    nombre: 'Plan Premium',
    precio: 97,
    descripcion: 'Todo lo del Estándar con SLA de respuesta garantizado.',
    features: [
      'TPV táctil ilimitado',
      'Carta digital con QR',
      'Gestión de reservas con RGPD',
      'Facturación Verifactu automática',
      'Informes y cierre de caja',
      'Actualizaciones incluidas',
      'Soporte con SLA de 48h garantizado',
    ],
    destacado: true,
  },
]
