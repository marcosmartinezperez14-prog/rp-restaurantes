import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import FinanzasClient from '@/components/finanzas/FinanzasClient'
import type { Movimiento } from '@/types/finanzas'
import type { TicketResumen } from '@/types/ticket'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function FinanzasPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx

  let tieneAcceso = isSuperadminMode
  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    const rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null
    tieneAcceso = !rol || PERMISOS_POR_ROL[rol].modulos.includes('finanzas')
  }

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
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('tickets')
      .select('id, ticket_number, issued_at, total, payment_method, order_id, verifactu_status, verifactu_response, anulado, anulado_at')
      .eq('restaurant_id', restaurantId)
      .order('issued_at', { ascending: false }),
  ])

  const movimientos = (movimientosResult.data ?? []) as Movimiento[]
  const ticketsRaw = ticketsResult.data ?? []

  const ingresos_tpv = ticketsRaw.reduce((sum, t) => sum + Number(t.total ?? 0), 0)
  const num_tickets = ticketsRaw.length

  const orderIds = [...new Set(ticketsRaw.map(t => t.order_id).filter(Boolean))] as string[]
  const mesaMap: Record<string, string> = {}

  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, tables(name)')
      .in('id', orderIds)

    for (const o of orders ?? []) {
      const tableName = (o.tables as unknown as { name: string } | null)?.name
      if (tableName) mesaMap[o.id] = tableName
    }
  }

  const tickets: TicketResumen[] = ticketsRaw.map(t => {
    const resp = t.verifactu_response as Record<string, unknown> | null
    return {
      id: t.id,
      numero_ticket: t.ticket_number,
      fecha: t.issued_at,
      total: Number(t.total),
      metodo_pago: t.payment_method,
      mesa_nombre: mesaMap[t.order_id] ?? 'Mesa',
      verifactu_status: (t.verifactu_status as string | null) ?? null,
      verifactu_url: (resp?.url as string | null) ?? null,
      anulado: !!(t.anulado as boolean | null),
      anulado_at: (t.anulado_at as string | null) ?? null,
    }
  })

  return (
    <AppShell title="Finanzas">
      <FinanzasClient
        movimientos={movimientos}
        ingresos_tpv={ingresos_tpv}
        num_tickets={num_tickets}
        restaurantId={restaurantId}
        tickets={tickets}
      />
    </AppShell>
  )
}
