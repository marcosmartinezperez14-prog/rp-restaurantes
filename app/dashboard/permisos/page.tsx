import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import ConfiguracionPermisos from '@/components/permisos/ConfiguracionPermisos'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function PermisosPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx

  let rol: RolNombre | null = null
  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null
    if (rol !== 'admin' && rol !== 'gerente') redirect('/dashboard')
  }

  const rolMostrado = (isSuperadminMode ? 'admin' : rol) as 'admin' | 'gerente'

  return (
    <AppShell title="Permisos">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Configuración de permisos</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Los cambios se aplican inmediatamente. Los usuarios afectados verán el nuevo acceso en su próxima navegación (caché de 5 minutos).
          </p>
        </div>
        <ConfiguracionPermisos rolUsuarioActual={rolMostrado} />
      </div>
    </AppShell>
  )
}
