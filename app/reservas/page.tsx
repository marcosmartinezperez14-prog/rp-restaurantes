import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getReservationsByDate, getTableOptions } from '@/app/actions/reservas'
import AppShell from '@/components/AppShell'
import ReservationsList from '@/components/reservas/ReservationsList'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const [reservations, tables] = await Promise.all([
    getReservationsByDate(today),
    getTableOptions(),
  ])

  return (
    <AppShell title="Reservas">
      <ReservationsList
        initialReservations={reservations}
        tables={tables}
        initialDate={today}
      />
    </AppShell>
  )
}
