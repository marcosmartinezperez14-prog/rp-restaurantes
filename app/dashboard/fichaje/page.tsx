import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import FichajeCliente from '@/components/fichajes/FichajeCliente'
import type { EstadoFichaje } from '@/types/fichajes'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function FichajePage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/dashboard')
  const { supabase, userId, isSuperadminMode } = ctx

  let isAdmin = isSuperadminMode
  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    const rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null
    isAdmin = rol === 'admin'
  }

  const { data: estadoData } = await supabase.rpc('get_estado_fichaje')
  const estadoInicial: EstadoFichaje = (estadoData as EstadoFichaje | null) ?? { abierto: false }

  return (
    <AppShell title="Fichaje">
      <FichajeCliente estadoInicial={estadoInicial} isAdmin={isAdmin} />
    </AppShell>
  )
}
