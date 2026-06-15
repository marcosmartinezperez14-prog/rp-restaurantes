import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPayload, sendToVerifacti } from '@/lib/verifacti/client'
import { jsonError } from '@/lib/api/errors'
import { z } from 'zod'
import type { TicketVerifactu } from '@/types/verifactu'

const schema = z.object({
  ticketId: z.string().uuid('ticketId no válido'),
  tipoFactura: z.enum(['F1', 'F2']).default('F2'),
  clienteNif: z.string().max(20).optional(),
  clienteNombre: z.string().max(120).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
  }
  const { ticketId, tipoFactura, clienteNif, clienteNombre } = parsed.data

  // ─── Ownership gate (CRÍTICO multi-tenant) ────────────────────────────────
  // Las RPCs fiscal_* son SECURITY DEFINER y saltan RLS, así que validamos AQUÍ
  // que el ticket pertenece al restaurante del usuario antes de operar sobre él.
  // El pre-check va con el cliente sujeto a RLS + filtro explícito por restaurante.
  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: owned } = await supabase
    .from('tickets')
    .select('id')
    .eq('id', ticketId)
    .eq('restaurant_id', userData.restaurant_id)
    .maybeSingle()
  if (!owned) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
  }

  // Reclama el ticket para emisión (bloqueo de fila + marca 'enviando').
  // Rechaza si ya está emitido o si hay otra emisión en curso → evita doble envío.
  const { data: claimed, error: claimError } = await supabase
    .rpc('fiscal_claim_emision', { p_ticket_id: ticketId, p_restaurant_id: userData.restaurant_id })

  if (claimError || !claimed) {
    // El RPC lanza EXCEPTION si ya emitido / en curso / no encontrado.
    return NextResponse.json(
      { error: claimError?.message ?? 'No se pudo reclamar el ticket para emisión' },
      { status: 409 },
    )
  }

  const ticket = claimed as TicketVerifactu & { restaurant_id: string }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('verifacti_api_key')
    .eq('id', ticket.restaurant_id)
    .single()

  const apiKey = (restaurant as Record<string, unknown> | null)?.verifacti_api_key as string | null
  if (!apiKey) {
    // Liberamos el estado 'enviando' para permitir reintento tras configurar la key.
    await supabase.rpc('fiscal_marcar_error_emision', {
      p_ticket_id: ticketId,
      p_restaurant_id: userData.restaurant_id,
      p_error: 'API key de Verifactu no configurada',
    })
    return NextResponse.json(
      { error: 'API key de Verifactu no configurada. Ve a Configuración para añadirla.' },
      { status: 422 },
    )
  }

  try {
    const payload = buildPayload(ticket, tipoFactura, clienteNif, clienteNombre)
    const respuesta = await sendToVerifacti(payload, apiKey)

    // Persiste la emisión: huella, prev_hash (encadenado), estado, sent_at, respuesta.
    const { error: persistError } = await supabase.rpc('fiscal_persistir_emision', {
      p_ticket_id: ticketId,
      p_restaurant_id: userData.restaurant_id,
      p_huella: respuesta.huella,
      p_estado: respuesta.estado,
      p_respuesta: respuesta,
    })

    if (persistError) {
      return jsonError('No se pudo registrar la emisión', 500, persistError)
    }

    return NextResponse.json({ ok: true, data: respuesta })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error desconocido'
    // Marca error (permite reintento: no fija verifactu_hash).
    await supabase.rpc('fiscal_marcar_error_emision', {
      p_ticket_id: ticketId,
      p_restaurant_id: userData.restaurant_id,
      p_error: mensaje,
    })
    return NextResponse.json({ error: mensaje }, { status: 502 })
  }
}
