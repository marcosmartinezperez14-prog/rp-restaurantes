import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import NegocioMovil from '@/components/negocio/NegocioMovil'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function NegocioPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx

  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    const rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null
    if (rol !== 'admin') redirect('/dashboard')
  }

  return (
    <AppShell title="Mi negocio">
      <NegocioMovil />
    </AppShell>
  )
}
