import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'

const schema = z.object({
  nombre: z.string().trim().min(1).max(120),
  nombre_restaurante: z.string().trim().min(1).max(120),
  email: z.string().email('Email no válido'),
  telefono: z.string().trim().min(1).max(30),
  mensaje: z.string().max(1000).nullish(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(schema, await req.json().catch(() => null))
    if (!parsed.ok) return parsed.response

    const { nombre, nombre_restaurante, email, telefono, mensaje } = parsed.data

    const db = getSupabaseAdmin()

    const { error } = await db
      .from('leads_contacto')
      .insert({ nombre, nombre_restaurante, email, telefono, mensaje: mensaje ?? null })

    if (error) return jsonError('No se pudo enviar el mensaje', 500, error)

    // Crear contacto + deal en el CRM (errores no críticos — no bloquean la respuesta)
    const { data: contact } = await db
      .from('crm_contacts')
      .insert({
        name: nombre,
        company: nombre_restaurante,
        email,
        phone: telefono,
        status: 'Lead',
        value: 0,
        owner: 'Sin asignar',
        notes: mensaje ?? '',
        last_contact: 'hoy',
      })
      .select('id')
      .single()

    if (contact) {
      await db.from('crm_deals').insert({
        title: `Contacto web — ${nombre_restaurante}`,
        company: nombre_restaurante,
        value: 0,
        stage: 'Lead',
        owner: 'Sin asignar',
        contact_id: contact.id,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return jsonError('Error interno', 500, err)
  }
}
