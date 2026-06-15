import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'

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

  const { data: turno } = await supabase
    .from('turnos_caja')
    .select('*')
    .eq('restaurant_id', userData.restaurant_id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) return NextResponse.json({ error: 'No hay turno abierto' }, { status: 400 })

  const body = await req.json()
  const efectivoContado = Number(body.efectivo_contado ?? 0)
  const notas: string | null = body.notas?.trim() || null

  // Calcular totales desde tickets + payments
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, total')
    .eq('restaurant_id', userData.restaurant_id)
    .gte('issued_at', turno.fecha_apertura)

  const ticketIds = (tickets ?? []).map(t => t.id)
  const totalVentas = (tickets ?? []).reduce((sum, t) => sum + Number(t.total), 0)
  const totalTickets = tickets?.length ?? 0

  let totalEfectivo = 0
  let totalTarjeta = 0

  if (ticketIds.length > 0) {
    const { data: pagos } = await supabase
      .from('payments')
      .select('method, amount')
      .in('ticket_id', ticketIds)

    for (const p of pagos ?? []) {
      if (p.method === 'cash') {
        totalEfectivo += Number(p.amount)
      } else {
        totalTarjeta += Number(p.amount)
      }
    }
  }

  const efectivoEsperado = Number(turno.fondo_inicial) + totalEfectivo
  const descuadre = efectivoContado - efectivoEsperado
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('turnos_caja')
    .update({
      estado: 'cerrado',
      fecha_cierre: now,
      cerrado_por: userData.id,
      efectivo_esperado: efectivoEsperado,
      efectivo_contado: efectivoContado,
      descuadre,
      total_ventas: totalVentas,
      total_efectivo: totalEfectivo,
      total_tarjeta: totalTarjeta,
      total_tickets: totalTickets,
      notas,
    })
    .eq('id', turno.id)

  if (updateError) return jsonError('No se pudo cerrar el turno', 500, updateError)

  const { data: turnoActualizado } = await supabase
    .from('turnos_caja')
    .select('*')
    .eq('id', turno.id)
    .single()

  const [{ data: u1 }, { data: u2 }] = await Promise.all([
    supabase.from('users').select('nombre').eq('id', turnoActualizado!.abierto_por).single(),
    supabase.from('users').select('nombre').eq('id', turnoActualizado!.cerrado_por).single(),
  ])

  return NextResponse.json({
    turno: {
      ...turnoActualizado,
      abierto_por_nombre: u1?.nombre ?? null,
      cerrado_por_nombre: u2?.nombre ?? null,
    },
  })
}
