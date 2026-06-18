import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperadmin } from '@/lib/auth/superadmin'
import { getPapeleraFase1 } from '@/app/actions/papelera'
import PapeleraView from './PapeleraView'

export default async function PapeleraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!await isSuperadmin(supabase, user.id)) redirect('/dashboard')

  const datos = await getPapeleraFase1()

  return <PapeleraView datos={datos} />
}
