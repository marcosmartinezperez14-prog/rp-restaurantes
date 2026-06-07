import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getCallerInfo(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('id, restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!data) return null
  const roles = data.user_roles as unknown as { roles: { name: string } | null }[]
  const rol = roles?.[0]?.roles?.name ?? null
  return { userId: data.id, restaurantId: data.restaurant_id, rol }
}

async function verificarTurno(supabase: Awaited<ReturnType<typeof createClient>>, id: string, restaurantId: string) {
  const { data } = await supabase
    .from('turnos')
    .select('id, restaurant_id')
    .eq('id', id)
    .single()
  if (!data || data.restaurant_id !== restaurantId) return false
  return true
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const caller = await getCallerInfo(supabase)
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const esGestor = caller.rol === 'admin' || caller.rol === 'gerente'
    if (!esGestor) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { id } = await params
    const ok = await verificarTurno(supabase, id, caller.restaurantId)
    if (!ok) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })

    const body = await req.json()
    const { hora_inicio, hora_fin, tipo, notas } = body

    const { data, error } = await supabase
      .from('turnos')
      .update({ hora_inicio, hora_fin, tipo, notas: notas ?? null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ turno: data })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const caller = await getCallerInfo(supabase)
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const esGestor = caller.rol === 'admin' || caller.rol === 'gerente'
    if (!esGestor) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { id } = await params
    const ok = await verificarTurno(supabase, id, caller.restaurantId)
    if (!ok) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })

    const { error } = await supabase.from('turnos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
