'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function clearAllData(): Promise<{ deleted: Record<string, number>; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()

  const restaurantId = userData?.restaurant_id
  if (!restaurantId) return { deleted: {}, error: 'No se encontró el restaurante' }

  const deleted: Record<string, number> = {}

  // order_items: no restaurant_id, delete via order IDs
  const { data: orderIds } = await supabase
    .from('orders')
    .select('id')
    .eq('restaurant_id', restaurantId)

  if (orderIds && orderIds.length > 0) {
    const ids = orderIds.map(o => o.id)
    const { count, error } = await supabase
      .from('order_items')
      .delete({ count: 'exact' })
      .in('order_id', ids)
    if (error) return { deleted, error: `Error en order_items: ${error.message}` }
    deleted['order_items'] = count ?? 0
  } else {
    deleted['order_items'] = 0
  }

  // tables with restaurant_id
  const tables: string[] = ['payments', 'tickets', 'orders', 'reservations', 'stock_movements', 'menu_item_ingredients', 'menu_items']
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .eq('restaurant_id', restaurantId)
    if (error) return { deleted, error: `Error en ${table}: ${error.message}` }
    deleted[table] = count ?? 0
  }

  return { deleted }
}
