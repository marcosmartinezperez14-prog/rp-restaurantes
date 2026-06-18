import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'
import { z } from 'zod'

const postSchema = z.object({
  empleado_id: z.string().uuid('Datos no válidos'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida'),
  tipo: z.string().min(1, 'Faltan campos obligatorios').max(50),
  notas: z.string().max(500).nullish(),
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
    const mes = searchParams.get('mes') // YYYY-MM
    const empleadoId = searchParams.get('empleado_id')

    const esGestor = caller.rol === 'admin' || caller.rol === 'gerente'

    let query = supabase
      .from('dias_libres')
      .select('*')
      .eq('restaurant_id', caller.restaurantId)
      .is('deleted_at', null)
      .order('fecha', { ascending: true })

    if (!esGestor) {
      query = query.eq('empleado_id', caller.userId)
    } else if (empleadoId) {
      query = query.eq('empleado_id', empleadoId)
    }

    if (mes) {
      const [year, month] = mes.split('-').map(Number)
      const primerDia = `${mes}-01`
      const ultimoDia = new Date(year, month, 0).toISOString().split('T')[0]
      query = query.gte('fecha', primerDia).lte('fecha', ultimoDia)
    }

    const { data, error } = await query
    if (error) return jsonError('No se pudieron cargar los días libres', 500, error)

    return NextResponse.json({ diasLibres: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const caller = await getCallerInfo(supabase)
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const esGestor = caller.rol === 'admin' || caller.rol === 'gerente'
    if (!esGestor) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const parsed = postSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
    }
    const { empleado_id, fecha, tipo, notas } = parsed.data

    // Upsert por UNIQUE(restaurant_id, empleado_id, fecha)
    const { data, error } = await supabase
      .from('dias_libres')
      .upsert(
        {
          restaurant_id: caller.restaurantId,
          empleado_id,
          fecha,
          tipo,
          notas: notas ?? null,
          creado_por: caller.userId,
          updated_at: new Date().toISOString(),
          deleted_at: null,
          deleted_by: null,
        },
        { onConflict: 'restaurant_id,empleado_id,fecha' }
      )
      .select()
      .single()

    if (error) return jsonError('No se pudo guardar el día libre', 500, error)

    return NextResponse.json({ diaLibre: data })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
