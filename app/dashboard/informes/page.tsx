import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import InformesCliente from '@/components/informes/InformesCliente'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function InformesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/login')

  const roles = userData.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  const tieneAcceso = !rol || PERMISOS_POR_ROL[rol].modulos.includes('administracion')

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
