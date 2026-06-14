// app/dashboard/superadmin/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SuperadminForm from './SuperadminForm'

export default async function SuperadminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const roles = userRecord?.user_roles as unknown as { roles: { name: string } | null }[]
  const isSuperadmin = roles?.some(r => r.roles?.name === 'superadmin') ?? false

  if (!isSuperadmin) redirect('/dashboard')

  return <SuperadminForm />
}
