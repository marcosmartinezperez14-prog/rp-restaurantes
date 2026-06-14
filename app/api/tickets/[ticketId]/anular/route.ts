import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelVerifacti } from '@/lib/verifacti/client'
import type { TicketVerifactu } from '@/types/verifactu'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { ticketId } = await params
  const body = await req.json().catch(() => ({})) as { motivo?: string }
  const motivo = body.motivo?.trim() || undefined

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select(
      'id, restaurant_id, anulado, verifactu_status, series, sequential_number, total, subtotal, tax_total, tax_breakdown, issued_at, issuer_nif, verifactu_hash, verifactu_prev_hash, verifactu_response, verifactu_sent_at',
    )
    .eq('id', ticketId)
    .eq('restaurant_id', userData.restaurant_id)
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
  }

  if (ticket.anulado) {
    return NextResponse.json({ error: 'El ticket ya está anulado' }, { status: 409 })
  }

  let verifactuWarning: string | undefined

  if (ticket.verifactu_status) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('verifacti_api_key')
      .eq('id', userData.restaurant_id)
      .single()

    const apiKey = (restaurant as Record<string, unknown> | null)?.verifacti_api_key as string | null

    if (apiKey) {
      try {
        await cancelVerifacti(ticket as TicketVerifactu, apiKey)
      } catch (err) {
        // No bloqueamos la anulación si Verifacti rechaza el R5 (ej: número ya existe)
        verifactuWarning = err instanceof Error ? err.message : 'Error al comunicar con Verifacti'
      }
    }
  }

  const { error: updateError } = await supabase
    .from('tickets')
    .update({
      anulado:          true,
      anulado_at:       new Date().toISOString(),
      motivo_anulacion: motivo ?? null,
    })
    .eq('id', ticketId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...(verifactuWarning ? { warning: verifactuWarning } : {}) })
}
