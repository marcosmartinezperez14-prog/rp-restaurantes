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
      .from('turnos')
      .select('*')
      .eq('restaurant_id', caller.restaurantId)
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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ turnos: data ?? [] })
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

    const body = await req.json()
    const { empleado_id, fecha, hora_inicio, hora_fin, tipo, notas } = body

    if (!empleado_id || !fecha || !hora_inicio || !hora_fin || !tipo) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('turnos')
      .insert({
        restaurant_id: caller.restaurantId,
        empleado_id,
        fecha,
        hora_inicio,
        hora_fin,
        tipo,
        notas: notas ?? null,
        creado_por: caller.userId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ turno: data })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
