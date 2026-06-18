import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { jsonError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { PLANES, PERIODICIDADES, calcularPrecio, type Periodicidad } from '@/lib/config/landing'

const MESES_VALIDOS = PERIODICIDADES.map(p => p.meses) as [number, ...number[]]

const schema = z.object({
  nombre:             z.string().trim().min(1).max(120),
  nombre_restaurante: z.string().trim().min(1).max(120),
  email:              z.string().email('Email no válido'),
  telefono:           z.string().trim().min(1).max(30),
  plan_id:            z.string().trim().min(1),
  periodicidad:       z.number().refine(v => (MESES_VALIDOS as number[]).includes(v), {
    message: 'Periodicidad no válida',
  }),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(schema, await req.json().catch(() => null))
    if (!parsed.ok) return parsed.response

    const { nombre, nombre_restaurante, email, telefono, plan_id, periodicidad } = parsed.data

    const plan = PLANES.find(p => p.id === plan_id)
    if (!plan) return jsonError('Plan no encontrado', 400)

    const meses = periodicidad as Periodicidad
    const totalEuros = calcularPrecio(plan.precio, meses)
    const unitAmountCents = Math.round(totalEuros * 100)

    // Guardar lead antes de crear la sesión
    const { data: lead, error: dbError } = await supabaseAdmin
      .from('leads_pago')
      .insert({
        nombre,
        nombre_restaurante,
        email,
        telefono,
        estado:       'iniciado',
        plan_interes: plan.nombre,
        periodicidad: meses,
      })
      .select('id')
      .single()

    if (dbError || !lead) return jsonError('No se pudo procesar la solicitud', 500, dbError)

    // Construir URL base desde los headers de la request
    const origin = req.headers.get('origin') ?? req.headers.get('referer')?.replace(/\/$/, '') ?? ''

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      client_reference_id: lead.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: unitAmountCents,
            recurring: {
              interval: 'month',
              interval_count: meses,
            },
            product_data: {
              name: `${plan.nombre} — ${meses === 1 ? 'mensual' : `${meses} meses`}`,
              description: plan.descripcion,
            },
          },
        },
      ],
      success_url: `${origin}/pago-completado`,
      cancel_url:  `${origin}/#pricing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return jsonError('Error al preparar el pago', 500, err)
  }
}
