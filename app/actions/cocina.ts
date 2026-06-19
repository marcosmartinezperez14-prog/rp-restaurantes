'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'

export type KitchenStatus = 'pending' | 'preparing' | 'ready'

export interface KitchenItem {
  id: string
  product_name: string
  quantity: number
  status: KitchenStatus
  notes: string | null
  created_at: string
  order_id: string
  order_number: number
  table_name: string
}

export async function getKitchenItems(): Promise<KitchenItem[]> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id, product_name, quantity, status, notes, created_at, order_id')
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'preparing', 'ready'])
    .order('created_at', { ascending: true })

  if (!orderItems || orderItems.length === 0) return []

  const orderIds = [...new Set(orderItems.map(i => i.order_id))]

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, table_id')
    .in('id', orderIds)

  if (!orders) return []

  const tableIds = [...new Set(orders.map(o => o.table_id).filter(Boolean))]

  const { data: tables } = tableIds.length > 0
    ? await supabase.from('tables').select('id, name').in('id', tableIds)
    : { data: [] as { id: string; name: string }[] }

  const orderMap = new Map(orders.map(o => [o.id, o]))
  const tableMap = new Map((tables ?? []).map(t => [t.id, t]))

  return orderItems.map(item => {
    const order = orderMap.get(item.order_id)
    const table = order ? tableMap.get(order.table_id) : null
    return {
      id: item.id,
      product_name: item.product_name,
      quantity: item.quantity,
      status: item.status as KitchenStatus,
      notes: item.notes,
      created_at: item.created_at,
      order_id: item.order_id,
      order_number: order?.order_number ?? 0,
      table_name: table?.name ?? 'Mesa ?',
    }
  })
}

export async function updateKitchenItemStatus(
  itemId: string,
  status: KitchenStatus
): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, restaurantId } = ctx

  const v = z.object({
    itemId: z.string().uuid(),
    status: z.enum(['pending', 'preparing', 'ready']),
  }).safeParse({ itemId, status })
  if (!v.success) return { error: 'Datos no válidos' }

  const { error } = await supabase
    .from('order_items')
    .update({ status })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (error) {
    console.error('[updateKitchenItemStatus] error:', error.message)
    return { error: 'No se pudo actualizar el estado' }
  }
  return {}
}
