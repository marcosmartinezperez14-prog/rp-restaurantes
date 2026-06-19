import { cookies } from 'next/headers'
import { SA_COOKIE } from '@/lib/auth/restaurant-context'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { cerrarSesionRemota } from '@/app/actions/superadmin'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const overrideId = cookieStore.get(SA_COOKIE)?.value

  let restaurantName: string | null = null
  if (overrideId) {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('restaurants')
      .select('name')
      .eq('id', overrideId)
      .single()
    restaurantName = data?.name ?? null
  }

  return (
    <>
      {overrideId && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm">
          <span className="text-amber-800 font-medium">
            Modo superadmin · Gestionando:{' '}
            <span className="font-bold">{restaurantName ?? overrideId}</span>
          </span>
          <form action={cerrarSesionRemota}>
            <button
              type="submit"
              className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-white transition-colors"
            >
              Salir
            </button>
          </form>
        </div>
      )}
      {children}
    </>
  )
}
