import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import ReservasView from '@/components/reservas/ReservasView'
import type { Reserva } from '@/types/reservas'

export default async function ReservasPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const { data: reservasRaw } = await supabase
    .from('reservations')
    .select('id, restaurant_id, customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, status, notes, consentimiento_rgpd, created_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('reservation_date', { ascending: false })
    .order('reservation_time', { ascending: true })

  const reservas: Reserva[] = (reservasRaw ?? []) as Reserva[]

  return (
    <AppShell title="Reservas">
      <ReservasView reservas={reservas} />
    </AppShell>
  )
}
