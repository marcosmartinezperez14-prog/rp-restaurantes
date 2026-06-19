import { redirect } from 'next/navigation'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
import AppShell from '@/components/AppShell'
import QRMesasView from '@/components/mesas/QRMesasView'
import Link from 'next/link'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

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
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx

  if (!isSuperadminMode) {
    const { data: ud } = await supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', userId)
      .single()
    const roles = ud?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
    const rolRaw = roles?.[0]?.roles?.name ?? null
    const rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null
    if (rol !== 'admin' && rol !== 'gerente') {
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
  }

  const [{ data: restaurantRaw }, { data: zonesRaw }, { data: tablesRaw }] = await Promise.all([
    supabase.from('restaurants').select('slug').eq('id', restaurantId).single(),
    supabase.from('zones').select('id, name, color').eq('restaurant_id', restaurantId).eq('is_active', true).is('deleted_at', null).order('position'),
    supabase.from('tables').select('id, name, capacity, zone_id').eq('restaurant_id', restaurantId).eq('is_active', true).is('deleted_at', null).order('position'),
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
