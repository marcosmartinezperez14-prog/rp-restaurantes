import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ModifierSnapshot } from '@/types/modificadores'
import type { SelectedModifier } from '@/app/actions/tpv'

const schema = z.object({
  orderId: z.string().uuid('orderId requerido'),
  productId: z.string().uuid('productId requerido'),
  quantity: z.number().int('quantity debe ser un número positivo').positive('quantity debe ser un número positivo').max(999),
  unit_price: z.number().nonnegative().optional(),
  modifiers: z.array(z.unknown()).optional(),
  modifiers_snapshot: z.array(z.unknown()).optional(),
  nota: z.string().max(500).nullish(),
  notes: z.string().max(500).nullish(),
})

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
    const { orderId, productId, quantity, unit_price, modifiers, modifiers_snapshot, nota, notes } = parsed.data

    const safeSnapshot: ModifierSnapshot[] = Array.isArray(modifiers_snapshot) ? modifiers_snapshot as ModifierSnapshot[] : []

    // Backwards compat: old clients send modifiers[], new clients send modifiers_snapshot
    const safeModifiers: SelectedModifier[] = Array.isArray(modifiers)
      ? modifiers as SelectedModifier[]
      : safeSnapshot.map(s => ({ option_id: s.option_id, name: s.option_name, price_adjustment: s.price_delta }))

    // nota (new) or notes (old) — accept either
    const safeNotes: string | null = typeof nota === 'string' && nota.trim()
      ? nota.trim()
      : typeof notes === 'string' && notes.trim()
        ? notes.trim()
        : null

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
    // unit_price from SelectorModificadores already includes variant/supplement pricing
    // Fall back to base price + legacy modifiers sum if not provided
    const unitPrice = typeof unit_price === 'number' && unit_price > 0
      ? unit_price
      : basePrice + safeModifiers.reduce((sum, m) => sum + m.price_adjustment, 0)
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
        modifiers_snapshot: safeSnapshot,
        notes: safeNotes,
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
