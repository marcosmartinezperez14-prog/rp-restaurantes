'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TicketCompleto } from '@/types/ticket'

const PRINTER_IP_KEY = 'rp_printer_ip'

interface Props {
  ticketId: string
  onClose: () => void
}

export default function TicketPreview({ ticketId, onClose }: Props) {
  const [ticket, setTicket] = useState<TicketCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [showIpPanel, setShowIpPanel] = useState(false)
  const [printerIp, setPrinterIp] = useState('')
  const [printSuccess, setPrintSuccess] = useState(false)

  const fetchTicket = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single()

      if (!ticket) { setError('Ticket no encontrado'); return }

      const { data: items } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, total_price')
        .eq('order_id', ticket.order_id)
        .neq('status', 'cancelled')

      const { data: order } = await supabase
        .from('orders')
        .select('table_id')
        .eq('id', ticket.order_id)
        .maybeSingle()

      let mesaNombre = 'Mesa'
      if (order?.table_id) {
        const { data: table } = await supabase
          .from('tables')
          .select('name')
          .eq('id', order.table_id)
          .maybeSingle()
        if (table?.name) mesaNombre = table.name
      }

      const total = Number(ticket.total)
      const iva = total - total / 1.21

      const built: TicketCompleto = {
        id: ticket.id,
        numero_ticket: ticket.ticket_number,
        fecha: ticket.issued_at,
        mesa_nombre: mesaNombre,
        comensales: 0,
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
        },
        items: (items ?? []).map(i => ({
          id: i.id,
          cantidad: i.quantity,
          precio_unitario: Number(i.unit_price),
          subtotal: Number(i.total_price),
          producto: { nombre: i.product_name },
        })),
      }

      setTicket(built)
    } catch {
      setError('Error al cargar el ticket')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    fetchTicket()
    const saved = localStorage.getItem(PRINTER_IP_KEY)
    if (saved) setPrinterIp(saved)
  }, [fetchTicket])

  async function handleDownloadPdf() {
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/pdf`)
      if (!res.ok) { setError('Error al generar el PDF'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-${ticket?.numero_ticket ?? ticketId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Error al descargar el PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handlePrintThermal() {
    if (!printerIp.trim()) { setPrintError('Introduce la IP de la impresora'); return }
    localStorage.setItem(PRINTER_IP_KEY, printerIp.trim())
    setPrintLoading(true)
    setPrintError(null)
    setPrintSuccess(false)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/print?printerIp=${encodeURIComponent(printerIp.trim())}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setPrintError(json.error ?? 'Error al imprimir')
      } else {
        setPrintSuccess(true)
        setShowIpPanel(false)
      }
    } catch {
      setPrintError('No se pudo conectar con la impresora')
    } finally {
      setPrintLoading(false)
    }
  }

  function handlePrintBrowser() {
    window.print()
  }

  function fmt(n: number) {
    return n.toFixed(2) + ' €'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      {/* Print-only: ocultar todo excepto el ticket */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .rp-ticket-print { display: block !important; position: fixed; inset: 0; }
        }
        .rp-ticket-print { display: none; }
      `}</style>

      {/* Modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-semibold text-[#0f172a]">Ticket de venta</h2>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#0f172a] text-xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <p className="text-center text-[#64748b] py-8">Cargando ticket...</p>
          )}
          {error && (
            <p className="text-center text-red-600 py-8">{error}</p>
          )}
          {ticket && !loading && (
            <>
              {/* Ticket paper preview */}
              <div
                className="rp-ticket-print"
                style={{
                  width: 300,
                  margin: '0 auto',
                  background: '#fff',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: '#111',
                  position: 'relative',
                  clipPath: `polygon(
                    0% 8px, 8px 0%, 16px 8px, 24px 0%, 32px 8px, 40px 0%, 48px 8px,
                    56px 0%, 64px 8px, 72px 0%, 80px 8px, 88px 0%, 96px 8px, 104px 0%,
                    112px 8px, 120px 0%, 128px 8px, 136px 0%, 144px 8px, 152px 0%,
                    160px 8px, 168px 0%, 176px 8px, 184px 0%, 192px 8px, 200px 0%,
                    208px 8px, 216px 0%, 224px 8px, 232px 0%, 240px 8px, 248px 0%,
                    256px 8px, 264px 0%, 272px 8px, 280px 0%, 288px 8px, 296px 0%,
                    300px 8px,
                    100% 100%, 0% 100%
                  )`,
                  paddingTop: 20,
                  paddingBottom: 20,
                  paddingLeft: 16,
                  paddingRight: 16,
                }}
              >
                {/* Restaurante */}
                <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                  {ticket.restaurante.nombre}
                </p>
                {ticket.restaurante.direccion && (
                  <p style={{ textAlign: 'center', fontSize: 11, color: '#555', marginBottom: 1 }}>
                    {ticket.restaurante.direccion}
                  </p>
                )}
                {ticket.restaurante.nif && (
                  <p style={{ textAlign: 'center', fontSize: 11, color: '#555', marginBottom: 1 }}>
                    NIF: {ticket.restaurante.nif}
                  </p>
                )}

                <hr style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: '#666' }}>Ticket nº</span>
                  <span>{ticket.numero_ticket}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: '#666' }}>Fecha</span>
                  <span>
                    {new Date(ticket.fecha).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: '#666' }}>Mesa</span>
                  <span>{ticket.mesa_nombre}</span>
                </div>

                <hr style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }} />

                {/* Cabecera items */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginBottom: 4 }}>
                  <span style={{ flex: 1 }}>Artículo</span>
                  <span style={{ width: 28, textAlign: 'right' }}>Ud</span>
                  <span style={{ width: 60, textAlign: 'right' }}>P.Unit</span>
                  <span style={{ width: 60, textAlign: 'right' }}>Importe</span>
                </div>

                {/* Items */}
                {ticket.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 11 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 4 }}>
                      {item.producto.nombre}
                    </span>
                    <span style={{ width: 28, textAlign: 'right' }}>{item.cantidad}</span>
                    <span style={{ width: 60, textAlign: 'right' }}>{fmt(item.precio_unitario)}</span>
                    <span style={{ width: 60, textAlign: 'right' }}>{fmt(item.subtotal)}</span>
                  </div>
                ))}

                <hr style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 11 }}>
                  <span style={{ color: '#666' }}>Base imponible</span>
                  <span>{fmt(ticket.total / 1.21)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 11 }}>
                  <span style={{ color: '#666' }}>IVA (21%)</span>
                  <span>{fmt(ticket.iva)}</span>
                </div>

                <hr style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>TOTAL</span>
                  <span style={{ fontWeight: 900, fontSize: 20 }}>{fmt(ticket.total)}</span>
                </div>

                <hr style={{ borderTop: '1px dashed #ccc', margin: '12px 0 8px' }} />

                <p style={{ textAlign: 'center', fontSize: 11, color: '#666', marginBottom: 2 }}>
                  Gracias por su visita
                </p>
                <p style={{ textAlign: 'center', fontSize: 10, color: '#999' }}>
                  RP Restaurant Platform
                </p>

                {ticket.hash_verifactu && (
                  <p style={{ textAlign: 'center', fontSize: 9, color: '#777', marginTop: 8 }}>
                    Registro fiscal verificable en<br />
                    sede.agenciatributaria.gob.es
                  </p>
                )}

                {/* QR placeholder */}
                <div style={{
                  width: 64, height: 64,
                  border: '1px solid #ddd',
                  margin: '12px auto 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 9, color: '#bbb', textAlign: 'center' }}>
                    {ticket.qr_verifactu ? 'QR' : '[QR fiscal\npendiente]'}
                  </span>
                </div>
              </div>

              {/* Panel IP impresora */}
              {showIpPanel && (
                <div className="mt-4 p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                  <p className="text-xs font-semibold text-[#64748b] mb-2">IP de la impresora térmica</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={printerIp}
                      onChange={e => setPrinterIp(e.target.value)}
                      placeholder="192.168.1.100"
                      className="flex-1 px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm text-black outline-none focus:border-[#2563eb]"
                    />
                    <button
                      onClick={handlePrintThermal}
                      disabled={printLoading}
                      className="px-4 py-2 bg-[#2563eb] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                    >
                      {printLoading ? 'Enviando...' : 'Imprimir'}
                    </button>
                  </div>
                  {printError && <p className="text-xs text-red-600 mt-2">{printError}</p>}
                  {printSuccess && <p className="text-xs text-green-600 mt-2">Impresión enviada correctamente</p>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Botones */}
        {ticket && !loading && (
          <div className="px-5 py-4 border-t border-[#e2e8f0] flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#2563eb] text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {pdfLoading ? 'Generando...' : 'Descargar PDF'}
              </button>
              <button
                onClick={() => setShowIpPanel(v => !v)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#e2e8f0] text-[#0f172a] hover:bg-slate-50 transition-colors"
              >
                Imprimir ticket
              </button>
            </div>
            <button
              onClick={handlePrintBrowser}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[#e2e8f0] text-[#64748b] hover:bg-slate-50 transition-colors"
            >
              Imprimir con navegador
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
