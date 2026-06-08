/*
 * Migraciones SQL necesarias (ejecutar manualmente en Supabase SQL Editor):
 *
 * ALTER TABLE tickets
 *   ADD COLUMN IF NOT EXISTS hash_verifactu text,
 *   ADD COLUMN IF NOT EXISTS qr_verifactu text;
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer')

// ─── Helper: construir contenido de impresión ─────────────────────────────────

async function fetchTicketForPrint(ticketId: string, restaurantId: string) {
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!ticket) return null

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('product_name, quantity, unit_price, total_price')
    .eq('order_id', ticket.order_id)
    .neq('status', 'cancelled')

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('table_id')
    .eq('id', ticket.order_id)
    .maybeSingle()

  let mesaNombre = 'Mesa'
  if (order?.table_id) {
    const { data: table } = await supabaseAdmin
      .from('tables')
      .select('name')
      .eq('id', order.table_id)
      .maybeSingle()
    if (table?.name) mesaNombre = table.name
  }

  return { ticket, items: items ?? [], mesaNombre }
}

function buildPrinter(printerIp?: string) {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${printerIp ?? '127.0.0.1'}`,
    characterSet: CharacterSet.PC858_EURO,
    options: { timeout: 3000 },
  })
}

function formatMoney(n: number): string {
  return n.toFixed(2) + ' EUR'
}

function fillLine(left: string, right: string, width = 32): string {
  const spaces = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(spaces) + right
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params
    const printerIp = req.nextUrl.searchParams.get('printerIp') ?? undefined

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

    const data = await fetchTicketForPrint(ticketId, userData.restaurant_id)
    if (!data) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    const { ticket, items, mesaNombre } = data
    const total = Number(ticket.total)
    const iva = total - total / 1.21

    const printer = buildPrinter(printerIp)

    // Cabecera
    printer.alignCenter()
    printer.bold(true)
    printer.println(ticket.issuer_name)
    printer.bold(false)
    if (ticket.issuer_address) printer.println(ticket.issuer_address)
    if (ticket.issuer_nif) printer.println(`NIF: ${ticket.issuer_nif}`)

    printer.drawLine()

    // Datos del ticket
    printer.alignLeft()
    printer.println(fillLine('Ticket:', ticket.ticket_number))
    printer.println(fillLine('Fecha:', new Date(ticket.issued_at).toLocaleString('es-ES')))
    printer.println(fillLine('Mesa:', mesaNombre))

    printer.drawLine()

    // Encabezado columnas
    printer.bold(true)
    printer.println(fillLine('Artículo', 'Importe'))
    printer.bold(false)

    // Líneas de productos
    for (const item of items) {
      const nombre = `${item.product_name} x${item.quantity}`
      const subtotal = formatMoney(Number(item.total_price))
      if (nombre.length + subtotal.length < 32) {
        printer.println(fillLine(nombre, subtotal))
      } else {
        printer.println(nombre)
        printer.alignRight()
        printer.println(subtotal)
        printer.alignLeft()
      }
    }

    printer.drawLine()

    // Subtotal / IVA / Total
    printer.println(fillLine('Base imponible:', formatMoney(total / 1.21)))
    printer.println(fillLine('IVA (21%):', formatMoney(iva)))

    printer.drawLine()

    printer.bold(true)
    printer.setTextDoubleHeight()
    printer.alignCenter()
    printer.println(`TOTAL: ${formatMoney(total)}`)
    printer.setTextNormal()
    printer.bold(false)

    printer.drawLine()

    printer.alignCenter()
    printer.println('Gracias por su visita')
    printer.println('RP Restaurant Platform')

    printer.newLine()
    printer.cut()

    if (printerIp) {
      await printer.execute()
      return NextResponse.json({ success: true })
    } else {
      const buffer: Buffer = printer.getBuffer()
      return NextResponse.json({
        commands: buffer.toString('base64'),
        printerConfig: { type: 'EPSON', encoding: 'PC858_EURO' },
      })
    }
  } catch (err) {
    console.error('[print] error:', err)
    return NextResponse.json({ error: 'Error al procesar la impresión' }, { status: 500 })
  }
}
