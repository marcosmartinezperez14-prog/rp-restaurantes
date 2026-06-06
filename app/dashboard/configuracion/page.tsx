import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import AparienciaPanel from '@/components/configuracion/AparienciaPanel'

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
      <div className="max-w-2xl mx-auto">
        <AparienciaPanel temaActual={tema} />
      </div>
    </AppShell>
  )
}
