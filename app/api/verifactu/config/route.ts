import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

// Devuelve restaurant_id y rol del usuario, o null si no hay restaurante.
async function getRestauranteYRol(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', userId)
    .single()
  if (!data?.restaurant_id) return null
  const roles = data.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  return { restaurantId: data.restaurant_id as string, rol }
}

// La gestión de la API key de Verifactu requiere permiso de administración.
function esAdmin(rol: RolNombre | null): boolean {
  return !rol || PERMISOS_POR_ROL[rol]?.modulos.includes('administracion')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const ctx = await getRestauranteYRol(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  if (!esAdmin(ctx.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const restaurantId = ctx.restaurantId

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

  const ctx = await getRestauranteYRol(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  if (!esAdmin(ctx.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const restaurantId = ctx.restaurantId

  const { apiKey } = await req.json() as { apiKey?: string }
  if (!apiKey?.trim()) return NextResponse.json({ error: 'La API key no puede estar vacía' }, { status: 400 })

  const { error } = await supabase
    .from('restaurants')
    .update({ verifacti_api_key: apiKey.trim() })
    .eq('id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
