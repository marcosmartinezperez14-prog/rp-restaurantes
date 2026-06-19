import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import InformesCliente from '@/components/informes/InformesCliente'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function InformesPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx

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
    tieneAcceso = !rol || PERMISOS_POR_ROL[rol].modulos.includes('administracion')
  }

  if (!tieneAcceso) {
    return (
      <AppShell title="Informes">
        <div className="flex items-center justify-center h-64">
          <p className="text-[var(--text-secondary)]">No tienes acceso a esta sección.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Informes">
      <InformesCliente />
    </AppShell>
  )
}
