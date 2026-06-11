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
    const body = await request.json() as {
      group_id?: unknown
      name?: unknown
      price_delta?: unknown
      is_default?: unknown
      sort_order?: unknown
    }

    const { group_id, name, price_delta, is_default, sort_order } = body

    if (!group_id || typeof group_id !== 'string') {
      return NextResponse.json({ error: 'group_id requerido' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name requerido' }, { status: 400 })
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

    // Verify the group belongs to this restaurant
    const { data: group, error: groupError } = await supabase
      .from('product_modifier_groups')
      .select('id')
      .eq('id', group_id)
      .eq('restaurant_id', restaurantId)
      .single()

    if (groupError || !group) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('product_modifier_options')
      .insert({
        group_id,
        name: name.trim(),
        price_delta: typeof price_delta === 'number' ? price_delta : 0,
        is_default: typeof is_default === 'boolean' ? is_default : false,
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
