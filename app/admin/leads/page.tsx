import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import LeadsView from './LeadsView'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const roles = userRecord?.user_roles as unknown as { roles: { name: string } | null }[]
  const isAdmin = roles?.some(r => r.roles?.name === 'superadmin' || r.roles?.name === 'admin') ?? false
  if (!isAdmin) redirect('/login')

  const [{ data: leadsPago }, { data: leadsContacto }] = await Promise.all([
    getSupabaseAdmin().from('leads_pago').select('*').order('created_at', { ascending: false }),
    getSupabaseAdmin().from('leads_contacto').select('*').order('created_at', { ascending: false }),
  ])

  return <LeadsView leadsPago={leadsPago ?? []} leadsContacto={leadsContacto ?? []} />
}
