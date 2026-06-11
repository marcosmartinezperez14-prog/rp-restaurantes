import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import FichajeCliente from '@/components/fichajes/FichajeCliente'
import type { EstadoFichaje } from '@/types/fichajes'
import type { RolNombre } from '@/types/equipo'

export default async function FichajePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/dashboard')

  const roles = userData.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null

  const { data: estadoData } = await supabase.rpc('get_estado_fichaje')
  const estadoInicial: EstadoFichaje = (estadoData as EstadoFichaje | null) ?? { abierto: false }

  const isAdmin = rol === 'admin'

  return (
    <AppShell title="Fichaje">
      <FichajeCliente estadoInicial={estadoInicial} isAdmin={isAdmin} />
    </AppShell>
  )
}
