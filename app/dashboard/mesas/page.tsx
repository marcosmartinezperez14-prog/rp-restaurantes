import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import AppShell from '@/components/AppShell'
import QRMesasView from '@/components/mesas/QRMesasView'
import Link from 'next/link'

interface Mesa {
  id: string
  name: string
  capacity: number
  zone_id: string | null
}

interface Zona {
  id: string
  name: string
  color: string | null
}

export default async function MesasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioActual } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!usuarioActual?.restaurant_id) redirect('/login')

  const roles = usuarioActual.user_roles as unknown as { roles: { name: string } | null }[]
  const rolActual = roles?.[0]?.roles?.name ?? null

  if (rolActual !== 'admin' && rolActual !== 'gerente') {
    return (
      <AppShell title="Mesas y QR">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--text-secondary)] text-center">No tienes permisos para acceder a esta sección.</p>
          <Link href="/dashboard" className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
            Volver al inicio
          </Link>
        </div>
      </AppShell>
    )
  }

  const restaurantId = usuarioActual.restaurant_id

  const [{ data: restaurantRaw }, { data: zonesRaw }, { data: tablesRaw }] = await Promise.all([
    supabaseAdmin.from('restaurants').select('slug').eq('id', restaurantId).single(),
    supabaseAdmin.from('zones').select('id, name, color').eq('restaurant_id', restaurantId).eq('is_active', true).is('deleted_at', null).order('position'),
    supabaseAdmin.from('tables').select('id, name, capacity, zone_id').eq('restaurant_id', restaurantId).eq('is_active', true).is('deleted_at', null).order('position'),
  ])

  const slug = (restaurantRaw as { slug: string } | null)?.slug ?? ''
  const zonas: Zona[] = (zonesRaw ?? []) as Zona[]
  const mesas: Mesa[] = (tablesRaw ?? []) as Mesa[]

  return (
    <AppShell title="Mesas y QR">
      <QRMesasView slug={slug} zonas={zonas} mesas={mesas} />
    </AppShell>
  )
}
