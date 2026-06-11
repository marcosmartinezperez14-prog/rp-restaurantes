import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ProcessPaymentParams } from '@/app/actions/tpv'

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
    const body = await request.json() as { orderId?: unknown } & Partial<ProcessPaymentParams>
    const { orderId, ...paramsRaw } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })
    }

    // Validate method
    const method = (paramsRaw as { method?: unknown }).method
    if (!method || !['cash', 'card', 'bizum', 'mixed'].includes(method as string)) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })
    }

    const params = paramsRaw as ProcessPaymentParams

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
      .select('id, table_id, subtotal, tax_amount, total')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'open')
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: 'Comanda no encontrada o ya cobrada' }, { status: 404 })
    }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name, nif, address')
      .eq('id', restaurantId)
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: 'Error al cargar los datos del restaurante' }, { status: 500 })
    }

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

    if (seqError || seqNum === null) {
      return NextResponse.json({ error: 'Error al generar el número de ticket' }, { status: 500 })
    }

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

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Error al crear el ticket' }, { status: 500 })
    }

    const now = new Date().toISOString()
    if (params.method === 'mixed') {
      const { error: payError } = await supabase.from('payments').insert([
        { restaurant_id: restaurantId, ticket_id: ticket.id, method: 'cash', amount: params.cashAmount, change_given: 0, processed_by: user.id, processed_at: now },
        { restaurant_id: restaurantId, ticket_id: ticket.id, method: 'card', amount: params.cardAmount, change_given: 0, processed_by: user.id, processed_at: now },
      ])
      if (payError) {
        return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
      }
    } else if (params.method === 'cash') {
      const { error: payError } = await supabase.from('payments').insert({
        restaurant_id: restaurantId, ticket_id: ticket.id, method: 'cash',
        amount: total, change_given: params.changeGiven, processed_by: user.id, processed_at: now,
      })
      if (payError) {
        return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
      }
    } else {
      const { error: payError } = await supabase.from('payments').insert({
        restaurant_id: restaurantId, ticket_id: ticket.id, method: params.method,
        amount: total, change_given: 0, processed_by: user.id, processed_at: now,
      })
      if (payError) {
        return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
      }
    }

    await supabase.from('orders').update({ status: 'paid', closed_by: user.id, closed_at: now }).eq('id', orderId)
    await supabase.from('tables').update({ status: 'free' }).eq('id', order.table_id)

    return NextResponse.json({ ticketId: ticket.id })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
