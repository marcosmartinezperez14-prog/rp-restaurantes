import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import AparienciaPanel from '@/components/configuracion/AparienciaPanel'
import CambiarPasswordPanel from '@/components/configuracion/CambiarPasswordPanel'
import VerifactuConfigPanel from '@/components/verifactu/VerifactuConfigPanel'
import CancelacionPanel from '@/components/configuracion/CancelacionPanel'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('users')
    .select('theme, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const tema = data?.theme ?? 'slate-light'
  const roles = data?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  const esAdmin = !rol || PERMISOS_POR_ROL[rol].modulos.includes('administracion')

  return (
    <AppShell title="Configuración">
      <div className="max-w-2xl mx-auto space-y-6">
        <AparienciaPanel temaActual={tema} />
        <CambiarPasswordPanel />
        {esAdmin && <VerifactuConfigPanel />}
        {esAdmin && <CancelacionPanel />}
      </div>
    </AppShell>
  )
}
