import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPayload, sendToVerifacti, updateTicketVerifactu } from '@/lib/verifacti/client'
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

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select(
      'id, series, sequential_number, total, subtotal, tax_total, tax_breakdown, issued_at, issuer_nif, verifactu_hash, verifactu_status, verifactu_response, verifactu_sent_at, verifactu_prev_hash'
    )
    .eq('id', ticketId)
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
  }

  try {
    const payload = buildPayload(
      ticket as TicketVerifactu,
      tipoFactura,
      clienteNif,
      clienteNombre,
    )

    const respuesta = await sendToVerifacti(payload)
    await updateTicketVerifactu(supabase, ticketId, respuesta)

    return NextResponse.json({ ok: true, data: respuesta })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: mensaje }, { status: 502 })
  }
}
