export interface VentasFranja {
  franja: string
  total_ventas: number
  num_pedidos: number
}

export interface VentasCamarero {
  camarero_nombre: string
  total_ventas: number
  num_pedidos: number
  ticket_medio: number
}

export interface ProductoRanking {
  producto_nombre: string
  categoria_nombre: string | null
  unidades_vendidas: number
  ingresos: number
}

export interface ResumenVentas {
  total_ingresos: number
  num_pedidos: number
  ticket_medio: number
  productos_distintos: number
}

export type RangoFecha = '7d' | '30d' | '90d' | 'custom'
