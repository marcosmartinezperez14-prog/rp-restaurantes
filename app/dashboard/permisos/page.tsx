import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import ConfiguracionPermisos from '@/components/permisos/ConfiguracionPermisos'
import type { RolNombre } from '@/types/equipo'

export default async function PermisosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const roles = userData?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null

  if (rol !== 'admin' && rol !== 'gerente') redirect('/dashboard')

  return (
    <AppShell title="Permisos">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Configuración de permisos</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Los cambios se aplican inmediatamente. Los usuarios afectados verán el nuevo acceso en su próxima navegación (caché de 5 minutos).
          </p>
        </div>
        <ConfiguracionPermisos rolUsuarioActual={rol as 'admin' | 'gerente'} />
      </div>
    </AppShell>
  )
}
