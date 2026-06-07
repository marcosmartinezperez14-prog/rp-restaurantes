import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import PersonalEmpleadoView from './components/PersonalEmpleadoView'
import PersonalAdminView from './components/PersonalAdminView'
import type { RolNombre } from '@/types/equipo'
import type { SolicitudVacacion, Turno, DiaLibre, EmpleadoResumen } from '@/types/personal'

export default async function PersonalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioActual } = await supabase
    .from('users')
    .select('id, auth_id, nombre, email, restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!usuarioActual?.restaurant_id) redirect('/login')

  const roles = usuarioActual.user_roles as unknown as { roles: { name: string } | null }[]
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const mesStr = `${year}-${String(month).padStart(2, '0')}`
  const primerDia = `${mesStr}-01`
  const ultimoDia = new Date(year, month, 0).toISOString().split('T')[0]

  const esGestor = rol === 'admin' || rol === 'gerente'

  if (esGestor) {
    const { data: usuariosRaw } = await supabase
      .from('users')
      .select('id, auth_id, nombre, email, user_roles!user_id(roles(name))')
      .eq('restaurant_id', usuarioActual.restaurant_id)
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
      .eq('restaurant_id', usuarioActual.restaurant_id)
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
      .eq('restaurant_id', usuarioActual.restaurant_id)
      .gte('fecha', primerDia)
      .lte('fecha', ultimoDia)

    const { data: diasLibresRaw } = await supabase
      .from('dias_libres')
      .select('*')
      .eq('restaurant_id', usuarioActual.restaurant_id)
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
    .eq('empleado_id', usuarioActual.id)
    .gte('fecha', primerDia)
    .lte('fecha', ultimoDia)

  const { data: diasLibresRaw } = await supabase
    .from('dias_libres')
    .select('*')
    .eq('empleado_id', usuarioActual.id)
    .gte('fecha', primerDia)
    .lte('fecha', ultimoDia)

  const { data: solicitudesRaw } = await supabase
    .from('solicitudes_vacaciones')
    .select('*')
    .eq('empleado_id', usuarioActual.id)
    .order('created_at', { ascending: false })

  return (
    <AppShell title="Mi Panel">
      <PersonalEmpleadoView
        userId={usuarioActual.id}
        nombre={usuarioActual.nombre ?? ''}
        turnos={(turnosRaw ?? []) as Turno[]}
        diasLibres={(diasLibresRaw ?? []) as DiaLibre[]}
        solicitudes={(solicitudesRaw ?? []) as SolicitudVacacion[]}
        mesActual={mesStr}
      />
    </AppShell>
  )
}
