import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', userId)
    .single()
  return data?.restaurant_id as string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

  const { data } = await supabase
    .from('restaurants')
    .select('verifacti_api_key')
    .eq('id', restaurantId)
    .single()

  const key = (data as Record<string, unknown> | null)?.verifacti_api_key as string | null
  return NextResponse.json({ configurada: !!key, preview: key ? key.slice(0, 8) + '...' : null })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

  const { apiKey } = await req.json() as { apiKey?: string }
  if (!apiKey?.trim()) return NextResponse.json({ error: 'La API key no puede estar vacía' }, { status: 400 })

  const { error } = await supabase
    .from('restaurants')
    .update({ verifacti_api_key: apiKey.trim() })
    .eq('id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
