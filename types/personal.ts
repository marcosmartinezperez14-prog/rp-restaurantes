export type EstadoVacacion = 'pendiente' | 'aprobada' | 'denegada'
export type TipoTurno = 'normal' | 'extra' | 'guardia'
export type TipoDiaLibre = 'libre' | 'festivo' | 'baja'

export interface SolicitudVacacion {
  id: string
  restaurant_id: string
  empleado_id: string
  fecha_inicio: string
  fecha_fin: string
  motivo: string | null
  estado: EstadoVacacion
  comentario_respuesta: string | null
  respondido_por: string | null
  created_at: string
  updated_at: string
  empleado?: {
    nombre: string
    email: string
    rol: string
  }
}

export interface Turno {
  id: string
  restaurant_id: string
  empleado_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  tipo: TipoTurno
  notas: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
  empleado?: {
    nombre: string
    rol: string
  }
}

export interface DiaLibre {
  id: string
  restaurant_id: string
  empleado_id: string
  fecha: string
  tipo: TipoDiaLibre
  notas: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
  empleado?: {
    nombre: string
  }
}

export interface EmpleadoResumen {
  user_id: string
  auth_id: string
  nombre: string
  email: string
  rol: string
}
