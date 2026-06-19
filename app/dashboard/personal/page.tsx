import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import PersonalEmpleadoView from './components/PersonalEmpleadoView'
import PersonalAdminView from './components/PersonalAdminView'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'
import type { SolicitudVacacion, Turno, DiaLibre, EmpleadoResumen } from '@/types/personal'

export default async function PersonalPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx

  let rol: RolNombre | null = null
  let internalUserId: string = userId

  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('id, user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    internalUserId = ud?.id ?? userId
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const mesStr = `${year}-${String(month).padStart(2, '0')}`
  const primerDia = `${mesStr}-01`
  const ultimoDia = new Date(year, month, 0).toISOString().split('T')[0]

  const esGestor = isSuperadminMode || rol === 'admin' || rol === 'gerente'

  if (esGestor) {
    const { data: usuariosRaw } = await supabase
      .from('users')
      .select('id, auth_id, nombre, email, user_roles!user_id(roles(name))')
      .eq('restaurant_id', restaurantId)
      .eq('activo', true)
      .order('nombre', { ascending: true })

    const empleados: EmpleadoResumen[] = (usuariosRaw ?? []).map(u => {
      const ur = (u.user_roles as unknown as { roles: { name: string } | null }[])?.[0]
      return {
        user_id: u.id,
        auth_id: u.auth_id,
        nombre: u.nombre ?? '',
        email: u.email ?? '',
        rol: ur?.roles?.name ?? 'camarero',
      }
    })

    const { data: solicitudesRaw } = await supabase
      .from('solicitudes_vacaciones')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })

    const solicitudesPendientes: SolicitudVacacion[] = (solicitudesRaw ?? []).map(s => ({
      ...s,
      empleado: empleados.find(e => e.user_id === s.empleado_id)
        ? {
            nombre: empleados.find(e => e.user_id === s.empleado_id)!.nombre,
            email: empleados.find(e => e.user_id === s.empleado_id)!.email,
            rol: empleados.find(e => e.user_id === s.empleado_id)!.rol,
          }
        : undefined,
    }))

    const { data: turnosRaw } = await supabase
      .from('turnos')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('fecha', primerDia)
      .lte('fecha', ultimoDia)

    const { data: diasLibresRaw } = await supabase
      .from('dias_libres')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('fecha', primerDia)
      .lte('fecha', ultimoDia)

    return (
      <AppShell title="Personal">
        <PersonalAdminView
          empleados={empleados}
          solicitudesPendientes={solicitudesPendientes}
          turnos={(turnosRaw ?? []) as Turno[]}
          diasLibres={(diasLibresRaw ?? []) as DiaLibre[]}
          mesActual={mesStr}
        />
      </AppShell>
    )
  }

  // Vista empleado
  const { data: turnosRaw } = await supabase
    .from('turnos')
    .select('*')
    .eq('empleado_id', internalUserId)
    .gte('fecha', primerDia)
    .lte('fecha', ultimoDia)

  const { data: diasLibresRaw } = await supabase
    .from('dias_libres')
    .select('*')
    .eq('empleado_id', internalUserId)
    .gte('fecha', primerDia)
    .lte('fecha', ultimoDia)

  const { data: solicitudesRaw } = await supabase
    .from('solicitudes_vacaciones')
    .select('*')
    .eq('empleado_id', internalUserId)
    .order('created_at', { ascending: false })

  // Need nombre/email for employee view — fetch from users table
  const { data: meRaw } = await supabase
    .from('users')
    .select('nombre, email')
    .eq('auth_id', userId)
    .single()

  return (
    <AppShell title="Mi Panel">
      <PersonalEmpleadoView
        userId={internalUserId}
        nombre={meRaw?.nombre ?? ''}
        turnos={(turnosRaw ?? []) as Turno[]}
        diasLibres={(diasLibresRaw ?? []) as DiaLibre[]}
        solicitudes={(solicitudesRaw ?? []) as SolicitudVacacion[]}
        mesActual={mesStr}
      />
    </AppShell>
  )
}
