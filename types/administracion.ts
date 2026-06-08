export type DiaSchedule = {
  activo: boolean
  apertura: string
  cierre: string
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

export const DEFAULT_CONFIG: ReservasConfig = {
  auto_confirm: true,
  duration_minutes: 90,
  schedule: {
    lunes:     { activo: true,  apertura: '13:00', cierre: '23:30' },
    martes:    { activo: true,  apertura: '13:00', cierre: '23:30' },
    miercoles: { activo: true,  apertura: '13:00', cierre: '23:30' },
    jueves:    { activo: true,  apertura: '13:00', cierre: '23:30' },
    viernes:   { activo: true,  apertura: '13:00', cierre: '23:30' },
    sabado:    { activo: true,  apertura: '13:00', cierre: '23:30' },
    domingo:   { activo: false, apertura: '13:00', cierre: '23:30' },
  },
}
