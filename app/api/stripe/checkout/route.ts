import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { STRIPE_PAYMENT_LINK } from '@/lib/config/landing'

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

    // Guardar lead antes de redirigir. El client_reference_id enlaza el pago
    // con este lead en el webhook checkout.session.completed.
    const { data: lead, error: dbError } = await supabaseAdmin
      .from('leads_pago')
      .insert({ nombre, nombre_restaurante, email, telefono, estado: 'iniciado' })
      .select('id')
      .single()

    if (dbError || !lead) return jsonError('No se pudo procesar la solicitud', 500, dbError)

    // Payment Link con client_reference_id para que el webhook lo resuelva
    const url = `${STRIPE_PAYMENT_LINK}?client_reference_id=${lead.id}&prefilled_email=${encodeURIComponent(email)}`

    return NextResponse.json({ url })
  } catch (err) {
    return jsonError('Error al preparar el pago', 500, err)
  }
}
