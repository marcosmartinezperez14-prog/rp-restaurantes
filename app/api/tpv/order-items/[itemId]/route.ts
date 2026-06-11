import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params

    if (!itemId) {
      return NextResponse.json({ error: 'itemId requerido' }, { status: 400 })
    }

    const body = await request.json() as { quantity?: unknown }
    const { quantity } = body

    if (typeof quantity !== 'number') {
      return NextResponse.json({ error: 'quantity debe ser un número' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const restaurantId = await getRestaurantId(supabase, user.id)
    if (!restaurantId) {
      return NextResponse.json({ error: 'Sin restaurante asociado' }, { status: 403 })
    }

    // quantity <= 0 → cancelar (remove) the item
    if (quantity <= 0) {
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
          cancelled_by: user.id,
        })
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)

      if (error) {
        return NextResponse.json({ error: 'No se pudo eliminar la línea' }, { status: 500 })
      }

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
            created_by: user.id,
          })
        }
      }

      return NextResponse.json({ ok: true })
    }

    // quantity > 0 → update
    const { data: item } = await supabase
      .from('order_items')
      .select('unit_price, quantity, product_id')
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 })
    }

    const { error } = await supabase
      .from('order_items')
      .update({ quantity, total_price: Number(item.unit_price) * quantity })
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId)

    if (error) {
      return NextResponse.json({ error: 'No se pudo actualizar la cantidad' }, { status: 500 })
    }

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
          created_by: user.id,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
