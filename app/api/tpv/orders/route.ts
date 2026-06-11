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

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tableId?: unknown }
    const { tableId } = body

    if (!tableId || typeof tableId !== 'string') {
      return NextResponse.json({ error: 'tableId requerido' }, { status: 400 })
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

    const { data: tableCheck } = await supabase
      .from('tables')
      .select('id')
      .eq('id', tableId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (!tableCheck) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }

    const { data: orderNumber, error: rpcError } = await supabase
      .rpc('get_next_order_number', { p_restaurant_id: restaurantId })

    if (rpcError || orderNumber === null) {
      return NextResponse.json(
        { error: `No se pudo obtener el número de comanda: ${rpcError?.message ?? 'sin respuesta'}` },
        { status: 500 }
      )
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
        opened_by: user.id,
        opened_at: new Date().toISOString(),
        order_date: today,
      })
      .select('id')
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: error?.message ?? 'No se pudo crear la comanda' },
        { status: 500 }
      )
    }

    await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId)

    return NextResponse.json({ orderId: order.id })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
