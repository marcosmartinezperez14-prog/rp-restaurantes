export type Franja = {
  apertura: string
  cierre: string
}

export type DiaSchedule = {
  activo: boolean
  franjas: Franja[]
}

export type Schedule = {
  lunes: DiaSchedule
  martes: DiaSchedule
  miercoles: DiaSchedule
  jueves: DiaSchedule
  viernes: DiaSchedule
  sabado: DiaSchedule
  domingo: DiaSchedule
}

export type ReservasConfig = {
  auto_confirm: boolean
  duration_minutes: number
  schedule: Schedule
}

const DEFAULT_FRANJA: Franja = { apertura: '13:00', cierre: '23:30' }

export const DEFAULT_CONFIG: ReservasConfig = {
  auto_confirm: true,
  duration_minutes: 90,
  schedule: {
    lunes:     { activo: true,  franjas: [DEFAULT_FRANJA] },
    martes:    { activo: true,  franjas: [DEFAULT_FRANJA] },
    miercoles: { activo: true,  franjas: [DEFAULT_FRANJA] },
    jueves:    { activo: true,  franjas: [DEFAULT_FRANJA] },
    viernes:   { activo: true,  franjas: [DEFAULT_FRANJA] },
    sabado:    { activo: true,  franjas: [DEFAULT_FRANJA] },
    domingo:   { activo: false, franjas: [DEFAULT_FRANJA] },
  },
}
