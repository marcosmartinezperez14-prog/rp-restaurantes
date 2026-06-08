export interface TicketCompleto {
  id: string
  numero_ticket: string
  fecha: string
  mesa_nombre: string
  comensales: number
  subtotal: number
  iva: number
  total: number
  metodo_pago: string
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
    producto: {
      nombre: string
    }
  }[]
}
