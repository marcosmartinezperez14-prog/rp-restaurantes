import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { getReservasConfig } from '@/app/actions/administracion'
import ReservasConfigPanel from '@/components/administracion/ReservasConfigPanel'

export default async function AdministracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const config = await getReservasConfig()

  return (
    <AppShell title="Administración">
      <div className="max-w-2xl mx-auto space-y-6">
        <ReservasConfigPanel initialConfig={config} />
      </div>
    </AppShell>
  )
}
