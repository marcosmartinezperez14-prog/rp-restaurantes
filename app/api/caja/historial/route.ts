import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pagina = Math.max(1, Number(searchParams.get('pagina') ?? 1))
  const limite = Math.min(50, Math.max(1, Number(searchParams.get('limite') ?? 20)))
  const offset = (pagina - 1) * limite

  const { data, count, error } = await supabase
    .from('turnos_caja')
    .select('*', { count: 'exact' })
    .eq('restaurant_id', userData.restaurant_id)
    .eq('estado', 'cerrado')
    .order('fecha_apertura', { ascending: false })
    .range(offset, offset + limite - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Batch user lookup
  const userIds = [...new Set([
    ...(data ?? []).map(t => t.abierto_por as string),
    ...(data ?? []).filter(t => t.cerrado_por).map(t => t.cerrado_por as string),
  ])]

  const userMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, nombre')
      .in('id', userIds)
    for (const u of users ?? []) {
      userMap[u.id] = u.nombre
    }
  }

  const turnos = (data ?? []).map(t => ({
    ...t,
    abierto_por_nombre: userMap[t.abierto_por] ?? null,
    cerrado_por_nombre: t.cerrado_por ? (userMap[t.cerrado_por] ?? null) : null,
  }))

  return NextResponse.json({ data: turnos, total: count ?? 0, pagina, limite })
}
