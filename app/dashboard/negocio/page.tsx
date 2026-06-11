import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import NegocioMovil from '@/components/negocio/NegocioMovil'
import type { RolNombre } from '@/types/equipo'

export default async function NegocioPage() {
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

  if (rol !== 'admin') redirect('/dashboard')

  return (
    <AppShell title="Mi negocio">
      <NegocioMovil />
    </AppShell>
  )
}
