'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { ModifierGroup, ModifierOption, ModifierSnapshot } from '@/types/modificadores'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'

const uuid = z.string().uuid()

// Loguea el detalle real en servidor y devuelve un mensaje genérico (#11).
function dbError(ctx: string, e: { message?: string } | null, publicMsg: string): { error: string } {
  console.error(`[tpv:${ctx}]`, e?.message)
  return { error: publicMsg }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'billing'
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type PaymentMethod = 'cash' | 'card' | 'bizum' | 'mixed'

export type ProductWithModifiers = {
  id: string
  name: string
  price: number
  tax_rate: number
  is_available: boolean
  category_id: string
  modifierGroups: ModifierGroup[]
}

export type Category = {
  id: string
  name: string
}

export type TableWithOrder = {
  id: string
  name: string
  capacity: number
  status: TableStatus
  openOrder?: { id: string; total: number; opened_at: string }
}

export type ZoneWithTables = {
  id: string
  name: string
  color: string
  tables: TableWithOrder[]
}

export type SelectedModifier = {
  option_id: string
  name: string
  price_adjustment: number
}

export type OrderItem = {
  id: string
  product_name: string
  product_price: number
  tax_rate: number
  quantity: number
  unit_price: number
  total_price: number
  modifiers: SelectedModifier[]
  modifiers_snapshot: ModifierSnapshot[]
  notes: string | null
  status: OrderItemStatus
}

export type OrderWithItems = {
  id: string
  order_number: number
  status: 'open' | 'paid' | 'cancelled'
  opened_at: string
  total: number
  table: { id: string; name: string }
  items: OrderItem[]
}

export type ProcessPaymentParams =
  | { method: 'cash'; cashAmount: number; changeGiven: number }
  | { method: 'card'; amount: number }
  | { method: 'bizum'; amount: number }
  | { method: 'mixed'; cashAmount: number; cardAmount: number }

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getZonesWithTables(): Promise<ZoneWithTables[]> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const { data: zones } = await supabase
    .from('zones')
    .select('id, name, color')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('position')

  if (!zones || zones.length === 0) return []

  const { data: tables } = await supabase
    .from('tables')
    .select('id, zone_id, name, capacity, status')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('position')

  const tableIds = (tables ?? []).map(t => t.id)

  const { data: openOrders } = tableIds.length > 0
    ? await supabase
        .from('orders')
        .select('id, table_id, total, opened_at')
        .in('table_id', tableIds)
        .eq('status', 'open')
        .is('deleted_at', null)
    : { data: [] as { id: string; table_id: string; total: number; opened_at: string }[] }

  return zones.map(zone => ({
    id: zone.id,
    name: zone.name,
    color: zone.color,
    tables: (tables ?? [])
      .filter(t => t.zone_id === zone.id)
      .map(t => {
        const order = (openOrders ?? []).find(o => o.table_id === t.id)
        return {
          id: t.id,
          name: t.name,
          capacity: t.capacity,
          status: t.status as TableStatus,
          openOrder: order
            ? { id: order.id, total: Number(order.total), opened_at: order.opened_at }
            : undefined,
        }
      }),
  }))
}

export async function getOpenOrder(tableId: string): Promise<{ orderId: string } | null> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('table_id', tableId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .maybeSingle()

  return data ? { orderId: data.id } : null
}

export async function createOrder(tableId: string): Promise<{ orderId: string } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId } = ctx

  const { data: tableCheck } = await supabase
    .from('tables')
    .select('id')
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!tableCheck) return { error: 'Mesa no encontrada' }

  const { data: orderNumber, error: rpcError } = await supabase
    .rpc('get_next_order_number', { p_restaurant_id: restaurantId })

  if (rpcError || orderNumber === null) {
    return dbError('createOrder.rpc', rpcError, 'No se pudo crear la comanda')
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      status: 'open',
      type: 'dine_in',
      order_number: orderNumber,
      opened_by: userId,
      opened_at: new Date().toISOString(),
      order_date: today,
    })
    .select('id')
    .single()

  if (error || !order) return dbError('createOrder', error, 'No se pudo crear la comanda')

  await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId)

  return { orderId: order.id }
}

export async function getOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, opened_at, total, table_id')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!order) return null

  const { data: table } = await supabase
    .from('tables')
    .select('id, name')
    .eq('id', order.table_id)
    .single()

  if (!table) return null

  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_name, product_price, tax_rate, quantity, unit_price, total_price, modifiers, modifiers_snapshot, notes, status')
    .eq('order_id', orderId)
    .neq('status', 'cancelled')
    .order('created_at')

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    opened_at: order.opened_at,
    total: Number(order.total),
    table: { id: table!.id, name: table!.name },
    items: (items ?? []).map(item => ({
      id: item.id,
      product_name: item.product_name,
      product_price: Number(item.product_price),
      tax_rate: Number(item.tax_rate),
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
      modifiers: (item.modifiers as SelectedModifier[]) ?? [],
      modifiers_snapshot: (item.modifiers_snapshot as ModifierSnapshot[]) ?? [],
      notes: item.notes,
      status: item.status as OrderItemStatus,
    })),
  }
}

export async function getMenuData(): Promise<{ categories: Category[]; products: ProductWithModifiers[] }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const [catResult, itemResult, gruposResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('position'),
    supabase
      .from('menu_items')
      .select('id, name, price, is_active, category_id')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('product_modifier_groups')
      .select('id, menu_item_id, name, type, required, allows_multiple, sort_order, options:product_modifier_options(id, name, price_delta, is_default, is_active, sort_order)')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const gruposPorItem = new Map<string, ModifierGroup[]>()
  for (const g of (gruposResult.data ?? [])) {
    const grupo: ModifierGroup = {
      id: g.id,
      restaurant_id: restaurantId,
      menu_item_id: g.menu_item_id,
      name: g.name,
      type: g.type as 'variante' | 'modificador',
      required: g.required,
      allows_multiple: g.allows_multiple,
      sort_order: g.sort_order,
      is_active: true,
      options: ((g.options as ModifierOption[]) ?? [])
        .filter(o => o.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    }
    const prev = gruposPorItem.get(g.menu_item_id) ?? []
    gruposPorItem.set(g.menu_item_id, [...prev, grupo])
  }

  return {
    categories: catResult.data ?? [],
    products: (itemResult.data ?? []).map(p => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      tax_rate: 0,
      is_available: p.is_active,
      category_id: p.category_id ?? '',
      modifierGroups: gruposPorItem.get(p.id) ?? [],
    })),
  }
}

export async function addOrderItem(
  orderId: string,
  productId: string,
  quantity: number,
  modifiers: SelectedModifier[],
  notes?: string
): Promise<{ itemId: string } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const v = z.object({
    orderId: uuid,
    productId: uuid,
    quantity: z.number().int().min(1).max(999),
    notes: z.string().max(500).optional(),
  }).safeParse({ orderId, productId, quantity, notes })
  if (!v.success) return { error: 'Datos no válidos' }

  const { data: orderCheck } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .maybeSingle()

  if (!orderCheck) return { error: 'Comanda no encontrada' }

  const { data: product } = await supabase
    .from('menu_items')
    .select('name, price, menu_category_id')
    .eq('id', productId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!product) return { error: 'Producto no encontrado' }

  let station: 'cocina' | 'barra' = 'cocina'
  if (product.menu_category_id) {
    const { data: cat } = await supabase
      .from('menu_categories')
      .select('station')
      .eq('id', product.menu_category_id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    if (cat?.station === 'barra') station = 'barra'
  }

  const basePrice = Number(product.price)
  const unitPrice = basePrice + modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)
  const totalPrice = unitPrice * quantity

  const { data: item, error } = await supabase
    .from('order_items')
    .insert({
      restaurant_id: restaurantId,
      order_id: orderId,
      product_id: productId,
      product_name: product.name,
      product_price: basePrice,
      tax_rate: 0,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      modifiers,
      notes: notes ?? null,
      status: 'pending',
      station,
    })
    .select('id')
    .single()

  if (error || !item) return { error: 'No se pudo añadir el producto' }

  return { itemId: item.id }
}

export async function markOrderItemServed(itemId: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) return { error: 'No autenticado' }
  const { supabase, restaurantId } = ctx

  const { error } = await supabase
    .from('order_items')
    .update({ status: 'served' })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (error) return dbError('markOrderItemServed', error, 'No se pudo marcar como servido')
  return {}
}

export async function getOrderItemStatuses(
  orderId: string
): Promise<{ id: string; status: OrderItemStatus }[]> {
  const ctx = await getRestaurantContext()
  if (!ctx) return []
  const { supabase, restaurantId } = ctx

  const { data } = await supabase
    .from('order_items')
    .select('id, status')
    .eq('order_id', orderId)
    .eq('restaurant_id', restaurantId)
    .not('status', 'eq', 'cancelled')

  return data ?? []
}

export async function updateOrderItemQuantity(
  itemId: string,
  quantity: number
): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId } = ctx

  const v = z.object({ itemId: uuid, quantity: z.number().int().max(999) }).safeParse({ itemId, quantity })
  if (!v.success) return { error: 'Datos no válidos' }

  if (quantity <= 0) return removeOrderItem(itemId)

  const { data: item } = await supabase
    .from('order_items')
    .select('unit_price, quantity, product_id')
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!item) return { error: 'Línea no encontrada' }

  const { error } = await supabase
    .from('order_items')
    .update({ quantity, total_price: Number(item.unit_price) * quantity })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: 'No se pudo actualizar la cantidad' }

  const delta = quantity - item.quantity
  if (delta !== 0) {
    const { data: prod } = await supabase
      .from('products')
      .select('track_stock, stock')
      .eq('id', item.product_id)
      .single()

    if (prod?.track_stock) {
      await supabase.from('products')
        .update({ stock: (Number(prod.stock) || 0) - delta })
        .eq('id', item.product_id)
        .eq('restaurant_id', restaurantId)

      await supabase.from('stock_movements').insert({
        restaurant_id: restaurantId,
        product_id: item.product_id,
        type: delta > 0 ? 'venta' : 'ajuste',
        quantity: Math.abs(delta),
        cost_price: null,
        purchase_date: null,
        notes: delta < 0 ? 'Reducción de cantidad en comanda' : null,
        created_by: userId,
      })
    }
  }

  return {}
}

export async function removeOrderItem(itemId: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId } = ctx

  const { data: item } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
    .single()

  const { error } = await supabase
    .from('order_items')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
    })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: 'No se pudo eliminar la línea' }

  if (item) {
    const { data: prod } = await supabase
      .from('products')
      .select('track_stock, stock')
      .eq('id', item.product_id)
      .single()

    if (prod?.track_stock) {
      await supabase.from('products')
        .update({ stock: (Number(prod.stock) || 0) + item.quantity })
        .eq('id', item.product_id)
        .eq('restaurant_id', restaurantId)

      await supabase.from('stock_movements').insert({
        restaurant_id: restaurantId,
        product_id: item.product_id,
        type: 'ajuste',
        quantity: item.quantity,
        cost_price: null,
        purchase_date: null,
        notes: 'Anulación de línea',
        created_by: userId,
      })
    }
  }

  return {}
}

export async function cancelOrder(orderId: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId } = ctx

  const { data: order } = await supabase
    .from('orders')
    .select('table_id')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!order) return { error: 'Comanda no encontrada' }

  const { data: activeItems } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId)
    .eq('restaurant_id', restaurantId)
    .neq('status', 'cancelled')

  await supabase
    .from('order_items')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: userId })
    .eq('order_id', orderId)
    .neq('status', 'cancelled')

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', closed_by: userId, closed_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return { error: 'No se pudo cancelar la comanda' }

  for (const item of activeItems ?? []) {
    const { data: prod } = await supabase
      .from('products')
      .select('track_stock, stock')
      .eq('id', item.product_id)
      .single()

    if (prod?.track_stock) {
      await supabase.from('products')
        .update({ stock: (Number(prod.stock) || 0) + item.quantity })
        .eq('id', item.product_id)
        .eq('restaurant_id', restaurantId)

      await supabase.from('stock_movements').insert({
        restaurant_id: restaurantId,
        product_id: item.product_id,
        type: 'ajuste',
        quantity: item.quantity,
        cost_price: null,
        purchase_date: null,
        notes: 'Cancelación de comanda',
        created_by: userId,
      })
    }
  }

  await supabase.from('tables').update({ status: 'free' }).eq('id', order.table_id)
  return {}
}

export async function processPayment(
  orderId: string,
  params: ProcessPaymentParams
): Promise<{ ticketId: string } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId } = ctx

  const money = z.number().nonnegative().max(1_000_000)
  const v = z.intersection(
    z.object({ orderId: uuid }),
    z.discriminatedUnion('method', [
      z.object({ method: z.literal('cash'), cashAmount: money, changeGiven: money }),
      z.object({ method: z.literal('card'), amount: money }),
      z.object({ method: z.literal('bizum'), amount: money }),
      z.object({ method: z.literal('mixed'), cashAmount: money, cardAmount: money }),
    ]),
  ).safeParse({ orderId, ...params })
  if (!v.success) return { error: 'Datos de pago no válidos' }

  const { data: order } = await supabase
    .from('orders')
    .select('id, table_id, subtotal, tax_amount, total')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .maybeSingle()

  if (!order) return { error: 'Comanda no encontrada o ya cobrada' }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, nif, address')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) return { error: 'Error al cargar los datos del restaurante' }

  const { data: items } = await supabase
    .from('order_items')
    .select('tax_rate, total_price')
    .eq('order_id', orderId)
    .neq('status', 'cancelled')

  const taxMap = new Map<number, { base: number; amount: number }>()
  for (const item of items ?? []) {
    const rate = Number(item.tax_rate)
    const totalWithTax = Number(item.total_price)
    const base = totalWithTax / (1 + rate / 100)
    const taxAmount = totalWithTax - base
    const prev = taxMap.get(rate) ?? { base: 0, amount: 0 }
    taxMap.set(rate, { base: prev.base + base, amount: prev.amount + taxAmount })
  }
  const taxBreakdown = Array.from(taxMap.entries()).map(([rate, v]) => ({
    rate,
    base: Number(v.base.toFixed(2)),
    amount: Number(v.amount.toFixed(2)),
  }))

  const { data: seqNum, error: seqError } = await supabase
    .rpc('get_next_ticket_number', { p_restaurant_id: restaurantId })

  if (seqError || seqNum === null) return { error: 'Error al generar el número de ticket' }

  const total = Number(order.total)
  const ticketNumber = `A-${String(seqNum).padStart(8, '0')}`

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      restaurant_id: restaurantId,
      order_id: orderId,
      ticket_number: ticketNumber,
      series: 'A',
      sequential_number: seqNum,
      issuer_name: restaurant.name,
      issuer_nif: restaurant.nif,
      issuer_address: restaurant.address ?? '',
      issued_at: new Date().toISOString(),
      subtotal: Number(order.subtotal),
      tax_breakdown: taxBreakdown,
      tax_total: Number(order.tax_amount),
      total,
      payment_method: params.method,
    })
    .select('id')
    .single()

  if (ticketError || !ticket) return { error: 'Error al crear el ticket' }

  const now = new Date().toISOString()
  if (params.method === 'mixed') {
    const { error: payError } = await supabase.from('payments').insert([
      { restaurant_id: restaurantId, ticket_id: ticket.id, method: 'cash', amount: params.cashAmount, change_given: 0, processed_by: userId, processed_at: now },
      { restaurant_id: restaurantId, ticket_id: ticket.id, method: 'card', amount: params.cardAmount, change_given: 0, processed_by: userId, processed_at: now },
    ])
    if (payError) return { error: 'Error al registrar el pago' }
  } else if (params.method === 'cash') {
    const { error: payError } = await supabase.from('payments').insert({
      restaurant_id: restaurantId, ticket_id: ticket.id, method: 'cash',
      amount: total, change_given: params.changeGiven, processed_by: userId, processed_at: now,
    })
    if (payError) return { error: 'Error al registrar el pago' }
  } else {
    const { error: payError } = await supabase.from('payments').insert({
      restaurant_id: restaurantId, ticket_id: ticket.id, method: params.method,
      amount: total, change_given: 0, processed_by: userId, processed_at: now,
    })
    if (payError) return { error: 'Error al registrar el pago' }
  }

  await supabase.from('orders').update({ status: 'paid', closed_by: userId, closed_at: now }).eq('id', orderId)
  await supabase.from('tables').update({ status: 'free' }).eq('id', order.table_id)

  return { ticketId: ticket.id }
}

export async function updateOrderItemNote(
  itemId: string,
  notes: string
): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const v = z.object({ itemId: uuid, notes: z.string().max(500) }).safeParse({ itemId, notes })
  if (!v.success) return { error: 'Datos no válidos' }

  const { error } = await supabase
    .from('order_items')
    .update({ notes: notes || null })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: 'No se pudo actualizar la nota' }
  return {}
}

export async function reserveTable(tableId: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const { data: tableCheck } = await supabase
    .from('tables')
    .select('id, status')
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!tableCheck) return { error: 'Mesa no encontrada' }
  if (tableCheck.status !== 'free') return { error: 'La mesa no está libre' }

  const { error } = await supabase
    .from('tables')
    .update({ status: 'reserved' })
    .eq('id', tableId)

  if (error) return dbError('reserveTable', error, 'No se pudo reservar la mesa')
  return {}
}

export async function cancelReservation(tableId: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const { data: tableCheck } = await supabase
    .from('tables')
    .select('id, status')
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!tableCheck) return { error: 'Mesa no encontrada' }
  if (tableCheck.status !== 'reserved') return { error: 'La mesa no está reservada' }

  const { error } = await supabase
    .from('tables')
    .update({ status: 'free' })
    .eq('id', tableId)

  if (error) return dbError('cancelReservation', error, 'No se pudo cancelar la reserva')
  return {}
}

export async function addTable(params: {
  name: string
  capacity: number
  zoneId: string
}): Promise<{ table: TableWithOrder } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const v = z.object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
    capacity: z.number().int().min(1, 'La capacidad debe ser al menos 1').max(100),
    zoneId: uuid,
  }).safeParse(params)
  if (!v.success) return { error: v.error.issues[0]?.message ?? 'Datos no válidos' }

  const { data: existing } = await supabase
    .from('tables')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .ilike('name', params.name.trim())
    .is('deleted_at', null)
    .limit(1)

  if (existing && existing.length > 0) return { error: `Ya existe una mesa llamada "${params.name.trim()}"` }

  const { data: posData } = await supabase
    .from('tables')
    .select('position')
    .eq('zone_id', params.zoneId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = posData && posData.length > 0 ? (posData[0].position ?? 0) + 1 : 1

  const { data, error } = await supabase
    .from('tables')
    .insert({
      restaurant_id: restaurantId,
      zone_id: params.zoneId,
      name: params.name.trim(),
      capacity: params.capacity,
      status: 'free',
      is_active: true,
      position: nextPosition,
    })
    .select('id, name, capacity, status')
    .single()

  if (error || !data) return dbError('addTable', error, 'No se pudo crear la mesa')

  return {
    table: {
      id: data.id,
      name: data.name,
      capacity: data.capacity,
      status: data.status as TableStatus,
    },
  }
}

export async function deleteTable(tableId: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId } = ctx

  const { data: table } = await supabase
    .from('tables')
    .select('status')
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!table) return { error: 'Mesa no encontrada' }
  if (table.status !== 'free') return { error: 'Cierra la comanda antes de eliminar la mesa' }

  const { error } = await supabase
    .from('tables')
    .update({ deleted_at: new Date().toISOString(), is_active: false, deleted_by: userId })
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)

  if (error) return dbError('deleteTable', error, 'No se pudo eliminar la mesa')
  return {}
}

export async function addZone(params: {
  name: string
  color: string
}): Promise<{ zone: ZoneWithTables } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const v = z.object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
    color: z.string().max(20),
  }).safeParse(params)
  if (!v.success) return { error: v.error.issues[0]?.message ?? 'Datos no válidos' }

  const { data: posData } = await supabase
    .from('zones')
    .select('position')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = posData && posData.length > 0 ? (posData[0].position ?? 0) + 1 : 1

  const { data, error } = await supabase
    .from('zones')
    .insert({
      restaurant_id: restaurantId,
      name: params.name.trim(),
      color: params.color,
      is_active: true,
      position: nextPosition,
    })
    .select('id, name, color')
    .single()

  if (error || !data) return dbError('addZone', error, 'No se pudo crear la zona')

  return { zone: { id: data.id, name: data.name, color: data.color, tables: [] } }
}

export async function deleteZone(zoneId: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId } = ctx

  const { data: activeTables } = await supabase
    .from('tables')
    .select('id')
    .eq('zone_id', zoneId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)

  if (activeTables && activeTables.length > 0) {
    return { error: 'Elimina todas las mesas de la zona antes de borrarla' }
  }

  const { error } = await supabase
    .from('zones')
    .update({ deleted_at: new Date().toISOString(), is_active: false, deleted_by: userId })
    .eq('id', zoneId)
    .eq('restaurant_id', restaurantId)

  if (error) return dbError('deleteZone', error, 'No se pudo eliminar la zona')
  return {}
}
