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
  const total    = Number(ticket.total) || 0
  const subtotal = Number(ticket.subtotal) || parseFloat((total / 1.21).toFixed(2))
  const taxTotal = Number(ticket.tax_total) || parseFloat((total - subtotal).toFixed(2))

  const breakdown: TaxBreakdownItem[] =
    Array.isArray(ticket.tax_breakdown) && ticket.tax_breakdown.length > 0
      ? ticket.tax_breakdown
      : [{
          tipo_impositivo: subtotal > 0 ? Math.round((taxTotal / subtotal) * 100) : 21,
          base_imponible:  subtotal,
          cuota_repercutida: taxTotal,
        }]

  const lineas = breakdown.map(item => ({
    base_imponible:    (Number(item.base_imponible) || 0).toFixed(2),
    tipo_impositivo:   String(Math.round(Number(item.tipo_impositivo) || 21)),
    cuota_repercutida: (Number(item.cuota_repercutida) || 0).toFixed(2),
  }))

  // Reconciliar: la suma de las líneas redondeadas debe cuadrar con el total
  // realmente cobrado (ticket.total). El residuo de redondeo se imputa a la
  // cuota de la última línea para evitar descuadres frente a la AEAT.
  if (total > 0 && lineas.length > 0) {
    const sumaLineas = lineas.reduce(
      (s, l) => s + parseFloat(l.base_imponible) + parseFloat(l.cuota_repercutida),
      0,
    )
    const diff = parseFloat((total - sumaLineas).toFixed(2))
    if (diff !== 0) {
      const ultima = lineas[lineas.length - 1]
      ultima.cuota_repercutida = (parseFloat(ultima.cuota_repercutida) + diff).toFixed(2)
    }
  }

  return lineas
}

export function buildPayload(
  ticket: TicketVerifactu,
  tipoFactura: 'F1' | 'F2',
  clienteNif?: string,
  clienteNombre?: string,
): VerifactiPayload {
  const lineas = buildLineas(ticket)
  const importeTotal = lineas.reduce(
    (sum, l) => sum + parseFloat(l.base_imponible) + parseFloat(l.cuota_repercutida),
    0,
  )

  const payload: VerifactiPayload = {
    serie:            ticket.series || 'A',
    numero:           String(ticket.sequential_number),
    fecha_expedicion: formatFecha(ticket.issued_at),
    tipo_factura:     tipoFactura,
    descripcion:      tipoFactura === 'F1' ? 'Factura normal' : 'Factura simplificada',
    lineas,
    importe_total:    importeTotal.toFixed(2),
  }

  if (tipoFactura === 'F1') {
    payload.nif    = clienteNif
    payload.nombre = clienteNombre
  }

  return payload
}

export async function cancelVerifacti(ticket: TicketVerifactu, apiKey: string): Promise<void> {
  if (!apiKey) throw new Error('API key de Verifacti no configurada para este restaurante')

  const body = {
    serie:            ticket.series || '',
    numero:           String(ticket.sequential_number),
    fecha_expedicion: formatFecha(ticket.issued_at),
  }

  const res = await fetch(`${VERIFACTI_BASE_URL}/verifactu/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Verifacti ${res.status}: ${text}`)
  }
}

export async function sendToVerifacti(payload: VerifactiPayload, apiKey: string): Promise<VerifactiRespuesta> {
  if (!apiKey) throw new Error('API key de Verifacti no configurada para este restaurante')

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
