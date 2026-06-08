export type EstadoTurno = 'abierto' | 'cerrado'

export interface TurnoCaja {
  id: string
  restaurant_id: string
  abierto_por: string
  cerrado_por: string | null
  fondo_inicial: number
  fecha_apertura: string
  fecha_cierre: string | null
  efectivo_esperado: number | null
  efectivo_contado: number | null
  descuadre: number | null
  total_ventas: number | null
  total_efectivo: number | null
  total_tarjeta: number | null
  total_tickets: number | null
  notas: string | null
  estado: EstadoTurno
  created_at: string
  abierto_por_nombre?: string
  cerrado_por_nombre?: string
}

export interface AbrirTurnoPayload {
  fondo_inicial: number
}

export interface CerrarTurnoPayload {
  efectivo_contado: number
  notas?: string
}

export interface ResumenActual {
  total_ventas: number
  total_efectivo: number
  total_tarjeta: number
  total_tickets: number
}
