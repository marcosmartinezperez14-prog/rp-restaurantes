import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import EquipoClient from '@/components/equipo/EquipoClient'
import type { UsuarioEquipo, RolNombre } from '@/types/equipo'
import { PERMISOS_POR_ROL } from '@/types/equipo'
import Link from 'next/link'

export default async function EquipoPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx

  let rolActual: RolNombre | null = null
  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    rolActual = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null

    if (rolActual !== 'admin' && rolActual !== 'gerente') {
      return (
        <AppShell title="Equipo">
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-[var(--text-secondary)] text-center">No tienes permisos para acceder a esta sección.</p>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </AppShell>
      )
    }
  }

  const { data: usuariosRaw } = await supabase
    .from('users')
    .select(`
      id,
      auth_id,
      nombre,
      email,
      avatar_url,
      activo,
      created_at,
      user_roles!user_id(id, roles(name))
    `)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true })

  const usuarios: UsuarioEquipo[] = (usuariosRaw ?? []).map((u) => {
    const ur = (u.user_roles as unknown as { id: string; roles: { name: string } | null }[])?.[0]
    return {
      id: u.id,
      auth_id: u.auth_id,
      nombre: u.nombre ?? '',
      email: u.email ?? '',
      avatar_url: u.avatar_url ?? null,
      activo: u.activo ?? true,
      created_at: u.created_at,
      rol: (ur?.roles?.name ?? 'camarero') as RolNombre,
      user_role_id: ur?.id ?? '',
    }
  })

  return (
    <AppShell title="Equipo">
      <EquipoClient
        usuarios={usuarios}
        rolActual={isSuperadminMode ? 'admin' : rolActual ?? 'camarero'}
        usuarioActualId={userId}
        restaurantId={restaurantId}
      />
    </AppShell>
  )
}
