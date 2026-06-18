import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'
import { z } from 'zod'

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')
const postSchema = z.object({
  empleado_id: z.string().uuid('Datos no válidos'),
  fecha_inicio: DATE,
  fecha_fin: DATE,
  motivo: z.string().max(500).nullish(),
})

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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const caller = await getCallerInfo(supabase)
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')

    const esGestor = caller.rol === 'admin' || caller.rol === 'gerente'

    let query = supabase
      .from('solicitudes_vacaciones')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (esGestor) {
      query = query.eq('restaurant_id', caller.restaurantId)
    } else {
      query = query.eq('empleado_id', caller.userId)
    }

    if (estado) query = query.eq('estado', estado)

    const { data, error } = await query
    if (error) return jsonError('No se pudieron cargar las solicitudes', 500, error)

    return NextResponse.json({ solicitudes: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const caller = await getCallerInfo(supabase)
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const parsed = postSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
    }
    const { empleado_id, fecha_inicio, fecha_fin, motivo } = parsed.data

    // Empleado solo puede crear solicitudes para sí mismo
    if (caller.rol !== 'admin' && caller.rol !== 'gerente' && empleado_id !== caller.userId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    if (fecha_fin < fecha_inicio) {
      return NextResponse.json({ error: 'La fecha de fin debe ser igual o posterior a la fecha de inicio' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('solicitudes_vacaciones')
      .insert({
        restaurant_id: caller.restaurantId,
        empleado_id,
        fecha_inicio,
        fecha_fin,
        motivo: motivo ?? null,
        estado: 'pendiente',
      })
      .select()
      .single()

    if (error) return jsonError('No se pudo crear la solicitud', 500, error)

    return NextResponse.json({ solicitud: data })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
