import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'

// IMPORTANTE: este webhook solo marca el lead como pagado.
// NO crea cuenta de restaurante ni asigna roles. El alta real
// la hace el administrador manualmente desde /admin/leads.
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Sin firma' }, { status: 400 })

  let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>>
  try {
    const rawBody = await req.text()
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] firma inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const leadId = session.metadata?.lead_id ?? session.client_reference_id

    if (leadId) {
      // Idempotente: solo actualiza si no está ya pagado
      await supabaseAdmin
        .from('leads_pago')
        .update({
          estado: 'pagado',
          stripe_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .neq('estado', 'pagado')
    }
  }

  return NextResponse.json({ received: true })
}
