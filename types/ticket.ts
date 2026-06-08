export interface TicketCompleto {
  id: string
  numero_ticket: string
  fecha: string
  mesa_nombre: string
  subtotal: number
  iva: number
  total: number
  metodo_pago: string
  estado?: string
  hash_verifactu?: string
  qr_verifactu?: string
  restaurante: {
    nombre: string
    direccion?: string
    nif?: string
    telefono?: string
  }
  items: {
    id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    producto: { nombre: string }
  }[]
}

export interface TicketResumen {
  id: string
  numero_ticket: string
  fecha: string
  total: number
  metodo_pago: string
  mesa_nombre: string
}
