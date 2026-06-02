'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReservationStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'

export type Reservation = {
  id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  party_size: number
  reservation_date: string
  reservation_time: string
  status: ReservationStatus
  notes: string | null
  table_id: string | null
  table_name: string | null
  created_at: string
}

export type TableOption = {
  id: string
  name: string
  capacity: number
  zone_name: string
}

export type ZoneOption = {
  id: string
  name: string
  color: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getRestaurantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('id', userId)
    .single()
  return data?.restaurant_id ?? null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getReservationsByDate(date: string): Promise<Reservation[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('reservations')
    .select('id, customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, status, notes, table_id, created_at, tables(name)')
    .eq('restaurant_id', restaurantId)
    .eq('reservation_date', date)
    .is('deleted_at', null)
    .order('reservation_time')

  return (data ?? []).map(r => ({
    id: r.id,
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    customer_email: r.customer_email ?? null,
    party_size: r.party_size,
    reservation_date: r.reservation_date,
    reservation_time: r.reservation_time,
    status: r.status as ReservationStatus,
    notes: r.notes ?? null,
    table_id: r.table_id ?? null,
    table_name: (r.tables as unknown as { name: string } | null)?.name ?? null,
    created_at: r.created_at,
  }))
}

export async function createReservation(params: {
  customerName: string
  customerPhone: string
  customerEmail?: string
  partySize: number
  date: string
  time: string
  zoneId?: string
  notes?: string
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!params.customerName.trim()) return { error: 'El nombre es obligatorio' }
  if (!params.customerPhone.trim()) return { error: 'El teléfono es obligatorio' }
  if (params.partySize < 1) return { error: 'El número de comensales debe ser al menos 1' }

  // Auto-assign best table in zone: smallest capacity >= partySize
  let tableId: string | null = null
  if (params.zoneId) {
    const { data: candidates } = await supabase
      .from('tables')
      .select('id, capacity')
      .eq('restaurant_id', restaurantId)
      .eq('zone_id', params.zoneId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .gte('capacity', params.partySize)
      .order('capacity')
      .limit(1)

    if (candidates && candidates.length > 0) {
      tableId = candidates[0].id
    }
  }

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      restaurant_id: restaurantId,
      customer_name: params.customerName.trim(),
      customer_phone: params.customerPhone.trim(),
      customer_email: params.customerEmail?.trim() || null,
      party_size: params.partySize,
      reservation_date: params.date,
      reservation_time: params.time,
      status: 'confirmed',
      table_id: tableId,
      notes: params.notes?.trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'No se pudo crear la reserva' }
  return { id: data.id }
}

export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { error } = await supabase
    .from('reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}

export async function deleteReservation(reservationId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { error } = await supabase
    .from('reservations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reservationId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}

export async function getTableOptions(): Promise<TableOption[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('tables')
    .select('id, name, capacity, zones(name)')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('position')

  return (data ?? []).map(t => ({
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    zone_name: (t.zones as unknown as { name: string } | null)?.name ?? '',
  }))
}

export async function getZones(): Promise<ZoneOption[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('zones')
    .select('id, name, color')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position')

  return (data ?? []).map(z => ({
    id: z.id,
    name: z.name,
    color: z.color ?? '#64748b',
  }))
}
