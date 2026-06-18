/*
 * Migraciones SQL necesarias (ejecutar manualmente en Supabase SQL Editor):
 *
 * ALTER TABLE tickets
 *   ADD COLUMN IF NOT EXISTS hash_verifactu text,
 *   ADD COLUMN IF NOT EXISTS qr_verifactu text;
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import React from 'react'
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { TicketCompleto } from '@/types/ticket'

Font.register({
  family: 'Courier',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/courierprime/v7/u-450q2lgwslOqpF_6gQ8kELawHp.ttf' },
    {
      src: 'https://fonts.gstatic.com/s/courierprime/v7/u-4k0q2lgwslOqpF_6gQ8kELY2K6U6G.ttf',
      fontWeight: 'bold',
    },
  ],
})

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 20,
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#111',
    backgroundColor: '#fff',
    width: 226,
  },
  header: {
    textAlign: 'center',
    marginBottom: 10,
  },
  nombre: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  subtexto: {
    fontSize: 7,
    textAlign: 'center',
    color: '#444',
    marginBottom: 1,
  },
  separador: {
    borderBottom: '1 dashed #999',
    marginVertical: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    fontSize: 7,
    color: '#555',
  },
  valor: {
    fontSize: 7,
  },
  itemNombre: {
    flex: 1,
    fontSize: 7,
  },
  itemQty: {
    width: 20,
    fontSize: 7,
    textAlign: 'right',
  },
  itemPrecio: {
    width: 40,
    fontSize: 7,
    textAlign: 'right',
  },
  itemSubtotal: {
    width: 45,
    fontSize: 7,
    textAlign: 'right',
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalValor: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  pie: {
    textAlign: 'center',
    fontSize: 7,
    color: '#666',
    marginTop: 4,
  },
  verifactu: {
    textAlign: 'center',
    fontSize: 6,
    color: '#555',
    marginTop: 4,
  },
  qrBox: {
    width: 60,
    height: 60,
    border: '1 solid #ccc',
    alignSelf: 'center',
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrPlaceholder: {
    fontSize: 6,
    color: '#aaa',
    textAlign: 'center',
  },
})

function fmt(n: number): string {
  return n.toFixed(2) + ' €'
}

function TicketPDF({ t }: { t: TicketCompleto }) {
  return (
    <Document title={`Ticket ${t.numero_ticket}`}>
      <Page size={[226, 600]} style={styles.page}>
        {/* Cabecera restaurante */}
        <View style={styles.header}>
          <Text style={styles.nombre}>{t.restaurante.nombre}</Text>
          {t.restaurante.direccion ? (
            <Text style={styles.subtexto}>{t.restaurante.direccion}</Text>
          ) : null}
          {t.restaurante.nif ? (
            <Text style={styles.subtexto}>NIF: {t.restaurante.nif}</Text>
          ) : null}
          {t.restaurante.telefono ? (
            <Text style={styles.subtexto}>Tel: {t.restaurante.telefono}</Text>
          ) : null}
        </View>

        <View style={styles.separador} />

        {/* Info ticket */}
        <View style={styles.row}>
          <Text style={styles.label}>Ticket nº</Text>
          <Text style={styles.valor}>{t.numero_ticket}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha</Text>
          <Text style={styles.valor}>
            {new Date(t.fecha).toLocaleString('es-ES', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Mesa</Text>
          <Text style={styles.valor}>{t.mesa_nombre}</Text>
        </View>

        <View style={styles.separador} />

        {/* Encabezado columnas */}
        <View style={[styles.row, { marginBottom: 4 }]}>
          <Text style={[styles.itemNombre, { color: '#555' }]}>Artículo</Text>
          <Text style={[styles.itemQty, { color: '#555' }]}>Ud</Text>
          <Text style={[styles.itemPrecio, { color: '#555' }]}>P.Unit</Text>
          <Text style={[styles.itemSubtotal, { color: '#555' }]}>Importe</Text>
        </View>

        {/* Líneas de producto */}
        {t.items.map(item => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.itemNombre}>{item.producto.nombre}</Text>
            <Text style={styles.itemQty}>{item.cantidad}</Text>
            <Text style={styles.itemPrecio}>{fmt(item.precio_unitario)}</Text>
            <Text style={styles.itemSubtotal}>{fmt(item.subtotal)}</Text>
          </View>
        ))}

        <View style={styles.separador} />

        {/* Subtotal / IVA */}
        <View style={styles.row}>
          <Text style={styles.label}>Subtotal (base)</Text>
          <Text style={styles.valor}>{fmt(t.subtotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>IVA incluido</Text>
          <Text style={styles.valor}>{fmt(t.iva)}</Text>
        </View>

        <View style={styles.separador} />

        {/* Total */}
        <View style={[styles.row, { marginTop: 4 }]}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValor}>{fmt(t.total)}</Text>
        </View>

        <View style={[styles.separador, { marginTop: 8 }]} />

        {/* Pie */}
        <Text style={styles.pie}>Gracias por su visita</Text>
        <Text style={styles.pie}>RP Restaurant Platform</Text>

        {/* Verifactu */}
        {t.hash_verifactu ? (
          <Text style={styles.verifactu}>
            Registro fiscal verificable en sede.agenciatributaria.gob.es
          </Text>
        ) : null}

        {/* QR placeholder */}
        <View style={styles.qrBox}>
          {t.qr_verifactu ? (
            <Text style={styles.qrPlaceholder}>QR</Text>
          ) : (
            <Text style={styles.qrPlaceholder}>{'[QR fiscal\npendiente]'}</Text>
          )}
        </View>
      </Page>
    </Document>
  )
}

// ─── Helper: construir TicketCompleto desde DB ────────────────────────────────

async function fetchTicketData(ticketId: string, restaurantId: string): Promise<TicketCompleto | null> {
  const { data: ticket } = await getSupabaseAdmin()
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!ticket) return null

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('phone')
    .eq('id', restaurantId)
    .maybeSingle()

  const { data: items } = await getSupabaseAdmin()
    .from('order_items')
    .select('id, product_name, quantity, unit_price, total_price')
    .eq('order_id', ticket.order_id)
    .neq('status', 'cancelled')

  const { data: order } = await getSupabaseAdmin()
    .from('orders')
    .select('table_id')
    .eq('id', ticket.order_id)
    .maybeSingle()

  let mesaNombre = 'Mesa'
  if (order?.table_id) {
    const { data: table } = await getSupabaseAdmin()
      .from('tables')
      .select('name')
      .eq('id', order.table_id)
      .maybeSingle()
    if (table?.name) mesaNombre = table.name
  }

  const total = Number(ticket.total)
  const iva = total - total / 1.21

  return {
    id: ticket.id,
    numero_ticket: ticket.ticket_number,
    fecha: ticket.issued_at,
    mesa_nombre: mesaNombre,
    subtotal: Number(ticket.subtotal),
    iva: Number(iva.toFixed(2)),
    total,
    metodo_pago: ticket.payment_method,
    hash_verifactu: (ticket as Record<string, unknown>).hash_verifactu as string | undefined,
    qr_verifactu: (ticket as Record<string, unknown>).qr_verifactu as string | undefined,
    restaurante: {
      nombre: ticket.issuer_name,
      direccion: ticket.issuer_address || undefined,
      nif: ticket.issuer_nif || undefined,
      telefono: restaurant?.phone || undefined,
    },
    items: (items ?? []).map(i => ({
      id: i.id,
      cantidad: i.quantity,
      precio_unitario: Number(i.unit_price),
      subtotal: Number(i.total_price),
      producto: { nombre: i.product_name },
    })),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('restaurant_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData?.restaurant_id) {
      return NextResponse.json({ error: 'Sin restaurante' }, { status: 403 })
    }

    const ticketData = await fetchTicketData(ticketId, userData.restaurant_id)
    if (!ticketData) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const buffer = await renderToBuffer(<TicketPDF t={ticketData} />)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ticket-${ticketData.numero_ticket}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[pdf] error:', err)
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 })
  }
}
