import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPayload, sendToVerifacti } from '@/lib/verifacti/client'
import type { TicketVerifactu, EnviarFacturaOpciones } from '@/types/verifactu'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { ticketId?: string } & Partial<EnviarFacturaOpciones>
  const { ticketId, tipoFactura = 'F2', clienteNif, clienteNombre } = body

  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId es obligatorio' }, { status: 400 })
  }

  // Reclama el ticket para emisión (bloqueo de fila + marca 'enviando').
  // Rechaza si ya está emitido o si hay otra emisión en curso → evita doble envío.
  const { data: claimed, error: claimError } = await supabase
    .rpc('fiscal_claim_emision', { p_ticket_id: ticketId })

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
      p_huella: respuesta.huella,
      p_estado: respuesta.estado,
      p_respuesta: respuesta,
    })

    if (persistError) {
      return NextResponse.json({ error: persistError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data: respuesta })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error desconocido'
    // Marca error (permite reintento: no fija verifactu_hash).
    await supabase.rpc('fiscal_marcar_error_emision', {
      p_ticket_id: ticketId,
      p_error: mensaje,
    })
    return NextResponse.json({ error: mensaje }, { status: 502 })
  }
}
