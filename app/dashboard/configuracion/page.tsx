import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import AparienciaPanel from '@/components/configuracion/AparienciaPanel'
import CambiarPasswordPanel from '@/components/configuracion/CambiarPasswordPanel'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('users')
    .select('theme')
    .eq('auth_id', user.id)
    .single()

  const tema = data?.theme ?? 'slate-light'

  return (
    <AppShell title="Configuración">
      <div className="max-w-2xl mx-auto space-y-6">
        <AparienciaPanel temaActual={tema} />
        <CambiarPasswordPanel />
      </div>
    </AppShell>
  )
}
