import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import FinanzasClient from '@/components/finanzas/FinanzasClient'
import type { Movimiento } from '@/types/finanzas'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function FinanzasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/login')
  const restaurantId = userData.restaurant_id

  const roles = userData.user_roles as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  const tieneAcceso = !rol || PERMISOS_POR_ROL[rol].modulos.includes('finanzas')

  if (!tieneAcceso) {
    return (
      <AppShell title="Finanzas">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--text-secondary)] text-center">No tienes permisos para acceder a esta sección.</p>
          <Link href="/dashboard" className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
            Volver al inicio
          </Link>
        </div>
      </AppShell>
    )
  }

  const [movimientosResult, ticketsResult] = await Promise.all([
    supabase
      .from('movimientos')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('tickets')
      .select('total')
      .eq('restaurant_id', restaurantId),
  ])

  const movimientos = (movimientosResult.data ?? []) as Movimiento[]
  const ticketsData = ticketsResult.data ?? []
  const ingresos_tpv = ticketsData.reduce((sum, t) => sum + Number(t.total ?? 0), 0)
  const num_tickets = ticketsData.length

  return (
    <AppShell title="Finanzas">
      <FinanzasClient
        movimientos={movimientos}
        ingresos_tpv={ingresos_tpv}
        num_tickets={num_tickets}
        restaurantId={restaurantId}
      />
    </AppShell>
  )
}
