export interface TaxBreakdownItem {
  tipo_impositivo: number
  base_imponible: number
  cuota_repercutida: number
}

export interface TicketVerifactu {
  id: string
  series: string
  sequential_number: number
  total: number
  subtotal: number
  tax_total: number
  tax_breakdown: TaxBreakdownItem[] | null
  issued_at: string
  issuer_nif: string | null
  verifactu_hash: string | null
  verifactu_status: string | null
  verifactu_response: object | null
  verifactu_sent_at: string | null
  verifactu_prev_hash: string | null
}

export interface VerifactiLinea {
  base_imponible: string
  tipo_impositivo: string
  cuota_repercutida: string
}

export interface VerifactiPayload {
  serie: string
  numero: string
  fecha_expedicion: string   // "DD-MM-YYYY"
  tipo_factura: 'F1' | 'F2'
  descripcion: string
  nif?: string
  nombre?: string
  lineas: VerifactiLinea[]
  importe_total: string
}

export interface VerifactiRespuesta {
  uuid: string
  estado: string
  url: string
  qr: string
  huella: string
}

export interface EnviarFacturaOpciones {
  tipoFactura: 'F1' | 'F2'
  clienteNif?: string
  clienteNombre?: string
}
