import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ItemPedido = {
  menu_item_id: string
  nombre: string
  precio: number
  cantidad: number
}

async function getRestauranteBySlug(slug: string) {
  const { data } = await supabaseAdmin
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

  const { data: mesa } = await supabaseAdmin
    .from('tables')
    .select('id, name, capacity')
    .eq('id', mesa_id)
    .eq('restaurant_id', restaurante.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!mesa) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })

  const { data: categorias } = await supabaseAdmin
    .from('categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurante.id)
    .is('deleted_at', null)
    .order('position')

  const { data: items } = await supabaseAdmin
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
    const body = await req.json()
    const items: ItemPedido[] = body.items ?? []

    if (!items.length) return NextResponse.json({ error: 'El pedido está vacío' }, { status: 400 })

    const restaurante = await getRestauranteBySlug(slug)
    if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

    const { data: mesa } = await supabaseAdmin
      .from('tables')
      .select('id')
      .eq('id', mesa_id)
      .eq('restaurant_id', restaurante.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!mesa) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })

    // Buscar order abierta para la mesa
    let orderId: string

    const { data: orderAbierta } = await supabaseAdmin
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
      const { data: orderNumber, error: rpcError } = await supabaseAdmin
        .rpc('get_next_order_number', { p_restaurant_id: restaurante.id })

      if (rpcError || orderNumber === null) {
        return NextResponse.json({ error: 'No se pudo crear la comanda' }, { status: 500 })
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: nuevaOrder, error: orderError } = await supabaseAdmin
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
      await supabaseAdmin
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', mesa_id)
    }

    // Verificar items contra la BD (precio real, items del restaurante)
    const { data: menuItems, error: menuError } = await supabaseAdmin
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
      const precio = Number(menuItem.price)
      return {
        restaurant_id: restaurante.id,
        order_id: orderId,
        product_id: item.menu_item_id,
        product_name: menuItem.name,
        product_price: precio,
        tax_rate: 0,
        quantity: item.cantidad,
        unit_price: precio,
        total_price: precio * item.cantidad,
        modifiers: [],
        notes: null,
        status: 'pending',
      }
    })

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, order_id: orderId })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
