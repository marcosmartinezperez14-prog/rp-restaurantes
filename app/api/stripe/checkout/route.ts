import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { STRIPE_PRICE_ID } from '@/lib/config/landing'

const schema = z.object({
  nombre: z.string().trim().min(1).max(120),
  nombre_restaurante: z.string().trim().min(1).max(120),
  email: z.string().email('Email no válido'),
  telefono: z.string().trim().min(1).max(30),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(schema, await req.json().catch(() => null))
    if (!parsed.ok) return parsed.response

    const { nombre, nombre_restaurante, email, telefono } = parsed.data

    const { data: lead, error: dbError } = await supabaseAdmin
      .from('leads_pago')
      .insert({ nombre, nombre_restaurante, email, telefono, estado: 'iniciado' })
      .select('id')
      .single()

    if (dbError || !lead) return jsonError('No se pudo procesar la solicitud', 500, dbError)

    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email,
      client_reference_id: lead.id,
      metadata: { lead_id: lead.id },
      success_url: `${origin}/pago-completado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
    })

    await supabaseAdmin
      .from('leads_pago')
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', lead.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return jsonError('Error al crear la sesión de pago', 500, err)
  }
}
