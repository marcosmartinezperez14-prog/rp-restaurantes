import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: turno } = await supabase
    .from('turnos_caja')
    .select('*')
    .eq('restaurant_id', userData.restaurant_id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) return NextResponse.json({ turno: null })

  const { data: u } = await supabase
    .from('users')
    .select('nombre')
    .eq('id', turno.abierto_por)
    .single()

  return NextResponse.json({
    turno: { ...turno, abierto_por_nombre: u?.nombre ?? null },
  })
}
