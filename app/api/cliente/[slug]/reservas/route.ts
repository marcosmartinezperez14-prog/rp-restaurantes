import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { checkRateLimit, clientIp } from '@/lib/api/rate-limit'
import { parseBody } from '@/lib/api/validate'
import { z } from 'zod'
import type { Schedule } from '@/types/administracion'

const DIA_MAP: Record<number, keyof Schedule> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
}

const reservaSchema = z.object({
  nombre_cliente: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'El nombre es demasiado largo'),
  telefono: z.string().trim().min(1, 'El teléfono es obligatorio').max(30, 'El teléfono no es válido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida'),
  hora: z.string().regex(/^\d{2}:\d{2}/, 'La hora no es válida'),
  num_personas: z.coerce.number().int().min(1, 'El número de personas debe ser al menos 1').max(50, 'El número de personas no es válido'),
  notas: z.string().max(500, 'Las notas son demasiado largas').nullish(),
  // Consentimiento RGPD obligatorio: debe ser exactamente true.
  consentimiento_rgpd: z.literal(true, { message: 'Debes aceptar la política de privacidad' }),
  consentimiento_texto_version: z.string().trim().min(1).max(20),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Rate-limit por IP+restaurante: máx 5 reservas / 10 min (#8)
    const allowed = await checkRateLimit(`reservas:${slug}:${clientIp(req)}`, 5, 600)
    if (!allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' }, { status: 429 })
    }

    const parsed = parseBody(reservaSchema, await req.json().catch(() => null))
    if (!parsed.ok) return parsed.response
    const { nombre_cliente, telefono, fecha, hora, num_personas, notas, consentimiento_texto_version } = parsed.data

    const today = new Date().toISOString().split('T')[0]
    if (fecha < today) return NextResponse.json({ error: 'La fecha no puede ser en el pasado' }, { status: 400 })

    const { data: restaurante } = await getSupabaseAdmin()
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

    const { data: settings, error: settingsError } = await getSupabaseAdmin()
      .from('reservation_settings')
      .select('auto_confirm, schedule')
      .eq('restaurant_id', restaurante.id)
      .maybeSingle()

    if (settingsError) {
      return jsonError('No se pudo procesar la reserva', 500, settingsError)
    }

    let autoConfirm = true

    if (settings) {
      const schedule = settings.schedule as Schedule
      autoConfirm = settings.auto_confirm

      const [anio, mes, dia] = fecha.split('-').map(Number)
      const diaSemana = new Date(anio, mes - 1, dia).getDay()
      const diaKey = DIA_MAP[diaSemana]
      const diaConfig = schedule[diaKey]

      if (!diaConfig.activo) {
        return NextResponse.json({ error: 'El restaurante no acepta reservas ese día' }, { status: 400 })
      }

      const franjas = diaConfig.franjas ?? []
      const horaValida = franjas.length > 0 && franjas.some(f => hora >= f.apertura && hora < f.cierre)
      if (!horaValida) {
        return NextResponse.json({ error: 'Fuera del horario de reservas' }, { status: 400 })
      }
    }

    const { data, error } = await getSupabaseAdmin()
      .from('reservations')
      .insert({
        restaurant_id: restaurante.id,
        customer_name: nombre_cliente.trim(),
        customer_phone: telefono.trim(),
        customer_email: null,
        party_size: Number(num_personas),
        reservation_date: fecha,
        reservation_time: hora,
        status: autoConfirm ? 'confirmed' : 'pending',
        notes: notas?.trim() || null,
        consentimiento_rgpd: true,
        consentimiento_timestamp: new Date().toISOString(),
        consentimiento_texto_version,
      })
      .select('id')
      .single()

    if (error || !data) return jsonError('No se pudo crear la reserva', 500, error)

    return NextResponse.json({ ok: true, id: data.id, auto_confirm: autoConfirm })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
