export const STRIPE_PAYMENT_LINK = process.env.STRIPE_PAYMENT_LINK ?? ''
export const CONTACTO_EMAIL = 'hola@gestionbar.com'

// Periodicidades disponibles (meses) y sus descuentos sobre el precio mensual base.
// Ajusta los porcentajes aquí cuando quieras cambiarlos.
export const PERIODICIDADES = [
  { meses: 1,  descuento: 0    },
  { meses: 6,  descuento: 0.10 },
  { meses: 12, descuento: 0.15 },
] as const

export type Periodicidad = typeof PERIODICIDADES[number]['meses']

/** Precio total por periodo (en euros, redondeado a 2 decimales). */
export function calcularPrecio(precioMensualBase: number, meses: Periodicidad): number {
  const p = PERIODICIDADES.find(p => p.meses === meses)!
  return Math.round(precioMensualBase * meses * (1 - p.descuento) * 100) / 100
}

/** Equivalente mensual del precio total (en euros, redondeado a 2 decimales). */
export function calcularEquivalenteMensual(precioMensualBase: number, meses: Periodicidad): number {
  return Math.round(calcularPrecio(precioMensualBase, meses) / meses * 100) / 100
}

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
