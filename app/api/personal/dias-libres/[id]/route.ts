import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'

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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const caller = await getCallerInfo(supabase)
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const esGestor = caller.rol === 'admin' || caller.rol === 'gerente'
    if (!esGestor) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { id } = await params

    // Verify belongs to same restaurant
    const { data: diaLibre } = await supabase
      .from('dias_libres')
      .select('id, restaurant_id')
      .eq('id', id)
      .single()

    if (!diaLibre || diaLibre.restaurant_id !== caller.restaurantId) {
      return NextResponse.json({ error: 'Día libre no encontrado' }, { status: 404 })
    }

    const { error } = await supabase
      .from('dias_libres')
      .update({ deleted_at: new Date().toISOString(), deleted_by: caller.userId })
      .eq('id', id)
    if (error) return jsonError('No se pudo eliminar el día libre', 500, error)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
