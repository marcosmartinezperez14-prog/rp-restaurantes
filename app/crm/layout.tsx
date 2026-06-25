import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperadmin } from '@/lib/auth/superadmin'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!await isSuperadmin(supabase, user.id)) redirect('/login')
  return <>{children}</>
}
