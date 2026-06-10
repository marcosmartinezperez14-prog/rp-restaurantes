import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { getReservasConfig, getAforoOnline } from '@/app/actions/administracion'
import ReservasConfigPanel from '@/components/administracion/ReservasConfigPanel'
import AforoOnlinePanel from '@/components/administracion/AforoOnlinePanel'

export default async function AdministracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [config, maxOnline] = await Promise.all([getReservasConfig(), getAforoOnline()])

  return (
    <AppShell title="Administración">
      <div className="max-w-2xl mx-auto space-y-6">
        <ReservasConfigPanel initialConfig={config} />
        <AforoOnlinePanel initialMax={maxOnline} />
      </div>
    </AppShell>
  )
}
