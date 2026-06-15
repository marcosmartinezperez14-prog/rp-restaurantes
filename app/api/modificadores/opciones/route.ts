import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'
import { z } from 'zod'

const schema = z.object({
  group_id: z.string().uuid('group_id requerido'),
  name: z.string().trim().min(1, 'name requerido').max(120),
  price_delta: z.number().optional().default(0),
  is_default: z.boolean().optional().default(false),
  sort_order: z.number().int().optional().default(0),
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
    const { group_id, name, price_delta, is_default, sort_order } = parsed.data

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
        name,
        price_delta,
        is_default,
        sort_order,
      })
      .select()
      .single()

    if (error) {
      return jsonError('No se pudo crear la opción', 500, error)
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
