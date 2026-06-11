import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SelectedModifier } from '@/app/actions/tpv'

async function getRestaurantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('id', userId)
    .single()
  return data?.restaurant_id ?? null
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      orderId?: unknown
      productId?: unknown
      quantity?: unknown
      modifiers?: unknown
      notes?: unknown
    }
    const { orderId, productId, quantity, modifiers, notes } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })
    }
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId requerido' }, { status: 400 })
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({ error: 'quantity debe ser un número positivo' }, { status: 400 })
    }

    const safeModifiers: SelectedModifier[] = Array.isArray(modifiers) ? modifiers as SelectedModifier[] : []
    const safeNotes: string | undefined = typeof notes === 'string' ? notes : undefined

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const restaurantId = await getRestaurantId(supabase, user.id)
    if (!restaurantId) {
      return NextResponse.json({ error: 'Sin restaurante asociado' }, { status: 403 })
    }

    const { data: orderCheck } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'open')
      .maybeSingle()

    if (!orderCheck) {
      return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 })
    }

    const { data: product } = await supabase
      .from('menu_items')
      .select('name, price')
      .eq('id', productId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const basePrice = Number(product.price)
    const unitPrice = basePrice + safeModifiers.reduce((sum, m) => sum + m.price_adjustment, 0)
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
        modifiers: safeModifiers,
        notes: safeNotes ?? null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error || !item) {
      return NextResponse.json({ error: 'No se pudo añadir el producto' }, { status: 500 })
    }

    return NextResponse.json({ itemId: item.id })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
