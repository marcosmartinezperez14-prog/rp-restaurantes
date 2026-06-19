import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SA_COOKIE = 'sa_restaurant_id'

export interface RestaurantContext {
  supabase: SupabaseClient
  restaurantId: string
  userId: string
  isSuperadminMode: boolean
}

export async function getRestaurantContext(): Promise<RestaurantContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const overrideId = cookieStore.get(SA_COOKIE)?.value

  if (overrideId) {
    const admin = getSupabaseAdmin()
    const { data: callerUser } = await admin
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (callerUser) {
      const { data: roleRows } = await admin
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', callerUser.id)
      const esSuperadmin = (roleRows ?? []).some((r: any) => r.roles?.name === 'superadmin')

      if (esSuperadmin) {
        return {
          supabase: admin,
          restaurantId: overrideId,
          userId: user.id,
          isSuperadminMode: true,
        }
      }
    }
  }

  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()

  if (!data?.restaurant_id) return null

  return {
    supabase,
    restaurantId: data.restaurant_id,
    userId: user.id,
    isSuperadminMode: false,
  }
}
