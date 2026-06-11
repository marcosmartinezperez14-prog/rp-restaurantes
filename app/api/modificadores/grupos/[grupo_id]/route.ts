import { NextRequest, NextResponse } from 'next/server'
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ grupo_id: string }> }
) {
  try {
    const { grupo_id } = await params

    const body = await request.json() as {
      name?: unknown
      required?: unknown
      allows_multiple?: unknown
      sort_order?: unknown
      is_active?: unknown
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

    const updates: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim()
    }
    if (typeof body.required === 'boolean') {
      updates.required = body.required
    }
    if (typeof body.allows_multiple === 'boolean') {
      updates.allows_multiple = body.allows_multiple
    }
    if (typeof body.sort_order === 'number') {
      updates.sort_order = body.sort_order
    }
    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active
    }

    const { data, error } = await supabase
      .from('product_modifier_groups')
      .update(updates)
      .eq('id', grupo_id)
      .eq('restaurant_id', restaurantId)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ grupo_id: string }> }
) {
  try {
    const { grupo_id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const restaurantId = await getRestaurantId(supabase, user.id)
    if (!restaurantId) {
      return NextResponse.json({ error: 'Sin restaurante asociado' }, { status: 403 })
    }

    const { error } = await supabase
      .from('product_modifier_groups')
      .update({ is_active: false })
      .eq('id', grupo_id)
      .eq('restaurant_id', restaurantId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
