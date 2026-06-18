import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import AppShell from '@/components/AppShell'
import ReservasView from '@/components/reservas/ReservasView'
import type { Reserva } from '@/types/reservas'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioActual } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()

  if (!usuarioActual?.restaurant_id) redirect('/login')

  const { data: reservasRaw } = await supabaseAdmin
    .from('reservations')
    .select('id, restaurant_id, customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, status, notes, consentimiento_rgpd, created_at')
    .eq('restaurant_id', usuarioActual.restaurant_id)
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
