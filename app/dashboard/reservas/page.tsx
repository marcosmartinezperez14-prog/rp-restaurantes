import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import AppShell from '@/components/AppShell'
import ReservasView from '@/components/reservas/ReservasView'
import type { Reserva } from '@/types/reservas'
import Link from 'next/link'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioActual } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!usuarioActual?.restaurant_id) redirect('/login')

  const roles = usuarioActual.user_roles as unknown as { roles: { name: string } | null }[]
  const rolActual = roles?.[0]?.roles?.name ?? null

  if (rolActual !== 'admin' && rolActual !== 'gerente') {
    return (
      <AppShell title="Reservas">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--text-secondary)] text-center">No tienes permisos para acceder a esta sección.</p>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </AppShell>
    )
  }

  const { data: reservasRaw } = await supabaseAdmin
    .from('reservations')
    .select('id, restaurant_id, customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, status, notes, consentimiento_rgpd, created_at')
    .eq('restaurant_id', usuarioActual.restaurant_id)
    .order('reservation_date', { ascending: false })
    .order('reservation_time', { ascending: true })

  const reservas: Reserva[] = (reservasRaw ?? []) as Reserva[]

  return (
    <AppShell title="Reservas">
      <ReservasView reservas={reservas} />
    </AppShell>
  )
}
