export interface Reserva {
  id: string
  restaurant_id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  party_size: number
  reservation_date: string   // YYYY-MM-DD
  reservation_time: string   // HH:MM
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  consentimiento_rgpd: boolean
  created_at: string
}
