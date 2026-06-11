export interface ResumenHoy {
  ingresos_hoy: number
  pedidos_cerrados: number
  ticket_medio: number
  mesas_ocupadas: number
  mesas_totales: number
  producto_estrella: string
  ingresos_ayer: number
}

export interface ActividadReciente {
  pedido_id: string
  mesa_nombre: string
  total: number
  cerrado_at: string
}
