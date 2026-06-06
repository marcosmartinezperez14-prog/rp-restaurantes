export type MovimientoTipo = 'ingreso' | 'gasto'
export type Recurrencia = 'unico' | 'mensual' | 'anual'

export interface Movimiento {
  id: string
  restaurant_id: string
  tipo: MovimientoTipo
  concepto: string
  importe: number
  categoria: string
  fecha: string
  recurrencia: Recurrencia
  notas: string | null
  factura_id: string | null
  created_at: string
  updated_at: string
}

export interface ResumenFinanciero {
  ingresos_tpv: number
  ingresos_manuales: number
  ingresos_total: number
  gastos_total: number
  beneficio_neto: number
  num_tickets: number
}

export interface DatoGrafico {
  periodo: string
  ingresos: number
  gastos: number
  beneficio: number
}
