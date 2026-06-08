import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const body = await req.json()
  const fondoInicial = Number(body.fondo_inicial ?? 0)

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

  if (error || !turno) return NextResponse.json({ error: error?.message ?? 'Error al abrir turno' }, { status: 500 })

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
