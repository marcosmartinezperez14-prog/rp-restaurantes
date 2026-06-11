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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })
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

    const { data: order } = await supabase
      .from('orders')
      .select('table_id')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 })
    }

    const { data: activeItems } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId)
      .eq('restaurant_id', restaurantId)
      .neq('status', 'cancelled')

    await supabase
      .from('order_items')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq('order_id', orderId)
      .neq('status', 'cancelled')

    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', closed_by: user.id, closed_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      return NextResponse.json({ error: 'No se pudo cancelar la comanda' }, { status: 500 })
    }

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
          created_by: user.id,
        })
      }
    }

    await supabase.from('tables').update({ status: 'free' }).eq('id', order.table_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
