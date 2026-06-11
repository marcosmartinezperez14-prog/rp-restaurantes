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
      menu_item_id?: unknown
      name?: unknown
      type?: unknown
      required?: unknown
      allows_multiple?: unknown
      sort_order?: unknown
    }

    const { menu_item_id, name, type, required, allows_multiple, sort_order } = body

    if (!menu_item_id || typeof menu_item_id !== 'string') {
      return NextResponse.json({ error: 'menu_item_id requerido' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name requerido' }, { status: 400 })
    }
    if (!type || (type !== 'variante' && type !== 'modificador')) {
      return NextResponse.json({ error: "type debe ser 'variante' o 'modificador'" }, { status: 400 })
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

    const { data, error } = await supabase
      .from('product_modifier_groups')
      .insert({
        restaurant_id: restaurantId,
        menu_item_id,
        name: name.trim(),
        type,
        required: typeof required === 'boolean' ? required : false,
        allows_multiple: typeof allows_multiple === 'boolean' ? allows_multiple : false,
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
