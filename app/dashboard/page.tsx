import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import RepairButton from './RepairButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AppShell title="Panel de control">
      <div className="max-w-sm">
        <p className="text-sm text-[#64748b] mb-4">
          Bienvenido, <span className="font-medium text-[#0f172a]">{user.email}</span>
        </p>
        <RepairButton />
      </div>
    </AppShell>
  )
}
