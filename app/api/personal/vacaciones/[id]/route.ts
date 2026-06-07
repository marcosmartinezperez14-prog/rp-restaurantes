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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const caller = await getCallerInfo(supabase)
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const esGestor = caller.rol === 'admin' || caller.rol === 'gerente'
    if (!esGestor) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { estado, comentario_respuesta } = body

    if (!estado || !['aprobada', 'denegada'].includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    // Verify solicitud belongs to same restaurant
    const { data: solicitud } = await supabase
      .from('solicitudes_vacaciones')
      .select('id, restaurant_id')
      .eq('id', id)
      .single()

    if (!solicitud || solicitud.restaurant_id !== caller.restaurantId) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    const { error } = await supabase
      .from('solicitudes_vacaciones')
      .update({
        estado,
        comentario_respuesta: comentario_respuesta ?? null,
        respondido_por: caller.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const caller = await getCallerInfo(supabase)
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params

    // Verify solicitud belongs to current user and is pending
    const { data: solicitud } = await supabase
      .from('solicitudes_vacaciones')
      .select('id, empleado_id, estado, restaurant_id')
      .eq('id', id)
      .single()

    if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

    const esGestor = caller.rol === 'admin' || caller.rol === 'gerente'
    const esPropietario = solicitud.empleado_id === caller.userId

    if (!esGestor && !esPropietario) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    if (!esGestor && solicitud.estado !== 'pendiente') {
      return NextResponse.json({ error: 'Solo se pueden cancelar solicitudes pendientes' }, { status: 400 })
    }

    if (solicitud.restaurant_id !== caller.restaurantId) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    const { error } = await supabase.from('solicitudes_vacaciones').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
