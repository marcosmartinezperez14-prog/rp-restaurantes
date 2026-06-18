import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { checkRateLimit, clientIp } from '@/lib/api/rate-limit'
import { parseBody } from '@/lib/api/validate'
import { z } from 'zod'

const modifierSnapshotSchema = z.object({
  group_id: z.string(),
  group_name: z.string(),
  group_type: z.string(),
  option_id: z.string(),
  option_name: z.string(),
  price_delta: z.number(),
})

const itemPedidoSchema = z.object({
  menu_item_id: z.string().uuid('Producto no válido'),
  nombre: z.string(),
  cantidad: z.number().int().min(1, 'Cantidad no válida').max(99, 'Cantidad no válida'),
  modifiers_snapshot: z.array(modifierSnapshotSchema).optional(),
  nota: z.string().max(500, 'Nota demasiado larga').nullish(),
})

const pedidoSchema = z.object({
  items: z.array(itemPedidoSchema).min(1, 'El pedido está vacío').max(100, 'El pedido tiene demasiados productos'),
})

type ItemPedido = z.infer<typeof itemPedidoSchema>

async function getRestauranteBySlug(slug: string) {
  const { data } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .single()
  return data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; mesa_id: string }> }
) {
  const { slug, mesa_id } = await params

  const restaurante = await getRestauranteBySlug(slug)
  if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

  const { data: mesa } = await getSupabaseAdmin()
    .from('tables')
    .select('id, name, capacity')
    .eq('id', mesa_id)
    .eq('restaurant_id', restaurante.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!mesa) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })

  const { data: categorias } = await getSupabaseAdmin()
    .from('categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurante.id)
    .is('deleted_at', null)
    .order('position')

  const { data: items } = await getSupabaseAdmin()
    .from('menu_items')
    .select('id, name, description, price, image_url, category_id, cantidad_minima')
    .eq('restaurant_id', restaurante.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  const carta = (categorias ?? []).map(cat => ({
    id: cat.id,
    nombre: cat.name,
    items: (items ?? [])
      .filter(item => item.category_id === cat.id)
      .map(item => ({
        id: item.id,
        nombre: item.name,
        descripcion: item.description ?? null,
        precio: Number(item.price),
        imagen_url: item.image_url ?? null,
        cantidad_minima: Number(item.cantidad_minima) || 1,
      })),
  })).filter(cat => cat.items.length > 0)

  return NextResponse.json({ mesa: { id: mesa.id, nombre: mesa.name }, carta })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; mesa_id: string }> }
) {
  try {
    const { slug, mesa_id } = await params

    // Rate-limit por IP+mesa: máx 20 pedidos / 5 min (#9)
    const allowed = await checkRateLimit(`pedido:${slug}:${mesa_id}:${clientIp(req)}`, 20, 300)
    if (!allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' }, { status: 429 })
    }

    const parsed = parseBody(pedidoSchema, await req.json().catch(() => null))
    if (!parsed.ok) return parsed.response
    const items: ItemPedido[] = parsed.data.items

    const restaurante = await getRestauranteBySlug(slug)
    if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

    const { data: mesa } = await getSupabaseAdmin()
      .from('tables')
      .select('id')
      .eq('id', mesa_id)
      .eq('restaurant_id', restaurante.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!mesa) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })

    // Buscar order abierta para la mesa
    let orderId: string

    const { data: orderAbierta } = await getSupabaseAdmin()
      .from('orders')
      .select('id')
      .eq('table_id', mesa_id)
      .eq('restaurant_id', restaurante.id)
      .eq('status', 'open')
      .is('deleted_at', null)
      .maybeSingle()

    if (orderAbierta) {
      orderId = orderAbierta.id
    } else {
      // Crear nueva order
      const { data: orderNumber, error: rpcError } = await getSupabaseAdmin()
        .rpc('get_next_order_number', { p_restaurant_id: restaurante.id })

      if (rpcError || orderNumber === null) {
        return NextResponse.json({ error: 'No se pudo crear la comanda' }, { status: 500 })
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: nuevaOrder, error: orderError } = await getSupabaseAdmin()
        .from('orders')
        .insert({
          restaurant_id: restaurante.id,
          table_id: mesa_id,
          status: 'open',
          type: 'dine_in',
          order_number: orderNumber,
          opened_at: new Date().toISOString(),
          order_date: today,
        })
        .select('id')
        .single()

      if (orderError || !nuevaOrder) {
        return NextResponse.json({ error: 'No se pudo crear la comanda' }, { status: 500 })
      }
      orderId = nuevaOrder.id

      // Marcar mesa como ocupada
      await getSupabaseAdmin()
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', mesa_id)
    }

    // Verificar items contra la BD (precio real, items del restaurante)
    const { data: menuItems, error: menuError } = await getSupabaseAdmin()
      .from('menu_items')
      .select('id, name, price')
      .in('id', items.map(i => i.menu_item_id))
      .eq('restaurant_id', restaurante.id)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (menuError || !menuItems?.length) {
      return NextResponse.json({ error: 'Productos no válidos' }, { status: 400 })
    }

    const menuItemsMap = new Map(menuItems.map(m => [m.id, m]))
    const itemsInvalidos = items.filter(i => !menuItemsMap.has(i.menu_item_id))
    if (itemsInvalidos.length > 0) {
      return NextResponse.json({ error: 'Algunos productos no están disponibles' }, { status: 400 })
    }

    // Insertar items
    const orderItemsData = items.map(item => {
      const menuItem = menuItemsMap.get(item.menu_item_id)!
      const basePrice = Number(menuItem.price)
      const snapshot = item.modifiers_snapshot ?? []
      const supplementSum = snapshot.reduce((sum: number, s: { price_delta: number }) => sum + (s.price_delta ?? 0), 0)
      const unitPrice = Math.max(0, basePrice + supplementSum)
      return {
        restaurant_id: restaurante.id,
        order_id: orderId,
        product_id: item.menu_item_id,
        product_name: menuItem.name,
        product_price: basePrice,
        tax_rate: 0,
        quantity: item.cantidad,
        unit_price: unitPrice,
        total_price: unitPrice * item.cantidad,
        modifiers: snapshot.map((s: { option_id: string; option_name: string; price_delta: number }) => ({
          option_id: s.option_id,
          name: s.option_name,
          price_adjustment: s.price_delta,
        })),
        modifiers_snapshot: snapshot,
        notes: item.nota ?? null,
        status: 'pending',
      }
    })

    const { error: itemsError } = await getSupabaseAdmin()
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      return jsonError('No se pudo registrar el pedido', 500, itemsError)
    }

    return NextResponse.json({ ok: true, order_id: orderId })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
