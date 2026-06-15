import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'
import { z } from 'zod'

const schema = z.object({ fondo_inicial: z.coerce.number().min(0).max(1_000_000).optional().default(0) })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('id, restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: turnoExistente } = await supabase
    .from('turnos_caja')
    .select('id')
    .eq('restaurant_id', userData.restaurant_id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (turnoExistente) {
    return NextResponse.json({ error: 'Ya hay un turno abierto' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
  }
  const fondoInicial = parsed.data.fondo_inicial

  const { data: turno, error } = await supabase
    .from('turnos_caja')
    .insert({
      restaurant_id: userData.restaurant_id,
      abierto_por: userData.id,
      fondo_inicial: fondoInicial,
      estado: 'abierto',
    })
    .select('*')
    .single()

  if (error || !turno) return jsonError('No se pudo abrir el turno', 500, error)

  const { data: u } = await supabase
    .from('users')
    .select('nombre')
    .eq('id', userData.id)
    .single()

  return NextResponse.json(
    { turno: { ...turno, abierto_por_nombre: u?.nombre ?? null } },
    { status: 201 }
  )
}
