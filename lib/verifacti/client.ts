import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  TicketVerifactu,
  VerifactiLinea,
  VerifactiPayload,
  VerifactiRespuesta,
  TaxBreakdownItem,
} from '@/types/verifactu'

const VERIFACTI_BASE_URL = 'https://api.verifacti.com'

function formatFecha(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function buildLineas(ticket: TicketVerifactu): VerifactiLinea[] {
  const breakdown: TaxBreakdownItem[] =
    Array.isArray(ticket.tax_breakdown) && ticket.tax_breakdown.length > 0
      ? ticket.tax_breakdown
      : [{
          tipo_impositivo: ticket.tax_total > 0
            ? Math.round((ticket.tax_total / ticket.subtotal) * 100)
            : 21,
          base_imponible: ticket.subtotal,
          cuota_repercutida: ticket.tax_total,
        }]

  return breakdown.map(item => ({
    base_imponible:     String(Number(item.base_imponible).toFixed(2)),
    tipo_impositivo:    String(item.tipo_impositivo),
    cuota_repercutida:  String(Number(item.cuota_repercutida).toFixed(2)),
  }))
}

export function buildPayload(
  ticket: TicketVerifactu,
  tipoFactura: 'F1' | 'F2',
  clienteNif?: string,
  clienteNombre?: string,
): VerifactiPayload {
  const payload: VerifactiPayload = {
    serie:            ticket.series || 'A',
    numero:           String(ticket.sequential_number),
    fecha_expedicion: formatFecha(ticket.issued_at),
    tipo_factura:     tipoFactura,
    descripcion:      tipoFactura === 'F1' ? 'Factura normal' : 'Factura simplificada',
    lineas:           buildLineas(ticket),
    importe_total:    String(Number(ticket.total).toFixed(2)),
  }

  if (tipoFactura === 'F1') {
    payload.nif    = clienteNif
    payload.nombre = clienteNombre
  }

  return payload
}

export async function sendToVerifacti(payload: VerifactiPayload): Promise<VerifactiRespuesta> {
  const apiKey = process.env.VERIFACTI_API_KEY
  if (!apiKey) throw new Error('VERIFACTI_API_KEY no configurada')

  const res = await fetch(`${VERIFACTI_BASE_URL}/verifactu/create`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Verifacti ${res.status}: ${text}`)
  }

  return res.json() as Promise<VerifactiRespuesta>
}

export async function updateTicketVerifactu(
  supabase: SupabaseClient,
  ticketId: string,
  respuesta: VerifactiRespuesta,
): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({
      verifactu_hash:     respuesta.huella,
      verifactu_status:   respuesta.estado,
      verifactu_response: respuesta,
      verifactu_sent_at:  new Date().toISOString(),
    })
    .eq('id', ticketId)

  if (error) throw new Error(`Error al actualizar ticket: ${error.message}`)
}
