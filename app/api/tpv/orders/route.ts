import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'
import { z } from 'zod'

const schema = z.object({ tableId: z.string().uuid('tableId requerido') })

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
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
    }
    const { tableId } = parsed.data

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
      return jsonError('No se pudo obtener el número de comanda', 500, rpcError)
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
      return jsonError('No se pudo crear la comanda', 500, error)
    }

    await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId)

    return NextResponse.json({ orderId: order.id })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
