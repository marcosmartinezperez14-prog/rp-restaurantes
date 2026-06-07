import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await req.json()
    const { nombre_cliente, telefono, fecha, hora, num_personas, notas } = body

    if (!nombre_cliente?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    if (!telefono?.trim()) return NextResponse.json({ error: 'El teléfono es obligatorio' }, { status: 400 })
    if (!fecha) return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 })
    if (!hora) return NextResponse.json({ error: 'La hora es obligatoria' }, { status: 400 })
    if (!num_personas || num_personas < 1) return NextResponse.json({ error: 'El número de personas debe ser al menos 1' }, { status: 400 })

    const { data: restaurante } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        restaurant_id: restaurante.id,
        customer_name: nombre_cliente.trim(),
        customer_phone: telefono.trim(),
        customer_email: null,
        party_size: Number(num_personas),
        reservation_date: fecha,
        reservation_time: hora,
        status: 'confirmed',
        notes: notas?.trim() || null,
      })
      .select('id')
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message ?? 'No se pudo crear la reserva' }, { status: 500 })

    return NextResponse.json({ ok: true, id: data.id })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
