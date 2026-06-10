import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import CajaClient from '@/components/caja/CajaClient'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'
import type { TurnoCaja, ResumenActual } from '@/types/caja'

export default async function CajaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('id, restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/login')
  const restaurantId = userData.restaurant_id

  const roles = userData.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  const tieneAcceso = rol ? PERMISOS_POR_ROL[rol].modulos.includes('administracion') : false

  if (!tieneAcceso) {
    return (
      <AppShell title="Caja">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--text-secondary)] text-center">No tienes permisos para acceder a esta sección.</p>
          <Link href="/dashboard" className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
            Volver al inicio
          </Link>
        </div>
      </AppShell>
    )
  }

  // Turno activo
  const { data: turnoRaw } = await supabase
    .from('turnos_caja')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('estado', 'abierto')
    .maybeSingle()

  let turnoActivo: TurnoCaja | null = null
  let resumenActual: ResumenActual | null = null

  if (turnoRaw) {
    const { data: u } = await supabase
      .from('users').select('nombre').eq('id', turnoRaw.abierto_por).single()
    turnoActivo = { ...turnoRaw, abierto_por_nombre: u?.nombre ?? undefined }

    // Calcular resumen en tiempo real
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, total')
      .eq('restaurant_id', restaurantId)
      .gte('issued_at', turnoRaw.fecha_apertura)

    const ticketIds = (tickets ?? []).map(t => t.id)
    let ef = 0, tar = 0

    if (ticketIds.length > 0) {
      const { data: pagos } = await supabase
        .from('payments').select('method, amount').in('ticket_id', ticketIds)
      for (const p of pagos ?? []) {
        if (p.method === 'cash') ef += Number(p.amount)
        else tar += Number(p.amount)
      }
    }

    resumenActual = {
      total_ventas: (tickets ?? []).reduce((s, t) => s + Number(t.total), 0),
      total_tickets: tickets?.length ?? 0,
      total_efectivo: ef,
      total_tarjeta: tar,
    }
  }

  // Historial (primeras 20 filas)
  const { data: historialRaw, count } = await supabase
    .from('turnos_caja')
    .select('*', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('estado', 'cerrado')
    .order('fecha_apertura', { ascending: false })
    .range(0, 19)

  const userIds = [...new Set([
    ...(historialRaw ?? []).map(t => t.abierto_por as string),
    ...(historialRaw ?? []).filter(t => t.cerrado_por).map(t => t.cerrado_por as string),
  ])]

  const userMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users').select('id, nombre').in('id', userIds)
    for (const u of users ?? []) userMap[u.id] = u.nombre
  }

  const historial: TurnoCaja[] = (historialRaw ?? []).map(t => ({
    ...t,
    abierto_por_nombre: userMap[t.abierto_por] ?? undefined,
    cerrado_por_nombre: t.cerrado_por ? (userMap[t.cerrado_por] ?? undefined) : undefined,
  }))

  return (
    <AppShell title="Caja">
      <CajaClient
        turnoActivo={turnoActivo}
        historial={historial}
        totalHistorial={count ?? 0}
        resumenActual={resumenActual}
      />
    </AppShell>
  )
}
