'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

const DEFAULT_SCHEDULE: Schedule = {
  lunes:     { activo: true,  apertura: '13:00', cierre: '23:30' },
  martes:    { activo: true,  apertura: '13:00', cierre: '23:30' },
  miercoles: { activo: true,  apertura: '13:00', cierre: '23:30' },
  jueves:    { activo: true,  apertura: '13:00', cierre: '23:30' },
  viernes:   { activo: true,  apertura: '13:00', cierre: '23:30' },
  sabado:    { activo: true,  apertura: '13:00', cierre: '23:30' },
  domingo:   { activo: false, apertura: '13:00', cierre: '23:30' },
}

export const DEFAULT_CONFIG: ReservasConfig = {
  auto_confirm: true,
  duration_minutes: 90,
  schedule: DEFAULT_SCHEDULE,
}

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, authId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', authId)
    .single()
  return data?.restaurant_id ?? null
}

export async function getReservasConfig(): Promise<ReservasConfig> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('reservation_settings')
    .select('auto_confirm, duration_minutes, schedule')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!data) return DEFAULT_CONFIG

  return {
    auto_confirm: data.auto_confirm,
    duration_minutes: data.duration_minutes,
    schedule: data.schedule as Schedule,
  }
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t)
}

export async function guardarReservasConfig(config: ReservasConfig): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Restaurante no encontrado' }

  if (config.duration_minutes < 15 || config.duration_minutes > 480) {
    return { error: 'La duración debe estar entre 15 y 480 minutos' }
  }

  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
  for (const dia of dias) {
    const d = config.schedule[dia]
    if (d.activo) {
      if (!isValidTime(d.apertura) || !isValidTime(d.cierre)) {
        return { error: `Horario inválido para ${dia}` }
      }
      if (d.apertura >= d.cierre) {
        return { error: `La hora de cierre debe ser posterior a la apertura (${dia})` }
      }
    }
  }

  const { error } = await supabase
    .from('reservation_settings')
    .upsert(
      {
        restaurant_id: restaurantId,
        auto_confirm: config.auto_confirm,
        duration_minutes: config.duration_minutes,
        schedule: config.schedule,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'restaurant_id' }
    )

  if (error) return { error: error.message }
  return { ok: true }
}
