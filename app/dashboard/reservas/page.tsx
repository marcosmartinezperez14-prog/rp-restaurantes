import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import ReservasView from '@/components/reservas/ReservasView'
import type { Reserva } from '@/types/reservas'
import Link from 'next/link'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function ReservasPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx

  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    const rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null

    if (rol !== 'admin' && rol !== 'gerente') {
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
  }

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
