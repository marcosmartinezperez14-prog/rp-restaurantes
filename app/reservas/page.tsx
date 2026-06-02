import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getReservationsByDate, getZones } from '@/app/actions/reservas'
import AppShell from '@/components/AppShell'
import ReservationsList from '@/components/reservas/ReservationsList'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const [reservations, zones] = await Promise.all([
    getReservationsByDate(today),
    getZones(),
  ])

  return (
    <AppShell title="Reservas">
      <ReservationsList
        initialReservations={reservations}
        zones={zones}
        initialDate={today}
      />
    </AppShell>
  )
}
