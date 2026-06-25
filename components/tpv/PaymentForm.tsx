'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderWithItems, PaymentMethod, ProcessPaymentParams } from '@/app/actions/tpv'
import { useOfflineFetch } from '@/lib/offline/useOfflineFetch'
import TicketPreview from '@/components/tpv/TicketPreview'

type Mode = 'full' | 'split'
type SplitMode = 'equal' | 'items'

const ACCENT = '#1f5d4c'
const PALETTE = ['#1f5d4c', '#2f5fa6', '#b5791f', '#8a3fa0', '#c0492f', '#0f7d8c']

function fmt(n: number) {
  return n.toFixed(2).replace('.', ',')
}

export default function PaymentForm({ order }: { order: OrderWithItems }) {
  const [mode, setMode] = useState<Mode>('full')
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [given, setGiven] = useState('')
  const [cashFocus, setCashFocus] = useState(false)
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [diners, setDiners] = useState(2)
  const [assign, setAssign] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [ticketId, setTicketId] = useState<string | null>(null)
  const router = useRouter()
  const { offlineFetch } = useOfflineFetch()

  const totalNum = Number(order.total)
  const total = fmt(totalNum)
  const count = order.items.reduce((a, i) => a + i.quantity, 0)

  const givenNum = parseFloat(given.replace(',', '.')) || 0
  const changeNum = Math.max(0, givenNum - totalNum)

  // flat units for split-by-items
  const flatUnits: { name: string; price: number }[] = []
  order.items.forEach(i => {
    for (let u = 0; u < i.quantity; u++) {
      flatUnits.push({ name: i.product_name, price: i.unit_price })
    }
  })

  const dinerList = Array.from({ length: diners }, (_, i) => ({
    idx: i,
    name: `Comensal ${i + 1}`,
    initial: `C${i + 1}`,
    color: PALETTE[i % PALETTE.length],
  }))

  const perPersonNum = dinerList.map(() => 0)
  const perPersonCount = dinerList.map(() => 0)
  let unassignedNum = 0
  let unassignedCount = 0
  flatUnits.forEach((u, i) => {
    const a = assign[i]
    if (a === undefined || a === -1 || a >= diners) {
      unassignedNum += u.price
      unassignedCount++
    } else {
      perPersonNum[a] += u.price
      perPersonCount[a]++
    }
  })

  function isValid() {
    if (method === 'cash') return givenNum >= totalNum
    return true
  }

  function buildParams(): ProcessPaymentParams {
    if (method === 'cash') return { method: 'cash', cashAmount: givenNum, changeGiven: changeNum }
    if (method === 'card') return { method: 'card', amount: totalNum }
    if (method === 'bizum') return { method: 'bizum', amount: totalNum }
    return { method: 'card', amount: totalNum }
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await offlineFetch({
        type: 'pay_order',
        endpoint: '/api/tpv/pay',
        method: 'POST',
        payload: { orderId: order.id, ...buildParams() },
      })
      if (!result.ok) { setError(result.error ?? 'Error al procesar el cobro'); return }
      if (result.offline) { router.push('/tpv'); return }
      const data = result.data as { ticketId: string }
      setTicketId(data.ticketId)
    })
  }

  const quickCash = [
    { label: 'Justo', action: () => setGiven(total) },
    { label: '€10', action: () => setGiven('10,00') },
    { label: '€20', action: () => setGiven('20,00') },
    { label: '€50', action: () => setGiven('50,00') },
  ]

  const methodDefs: { id: PaymentMethod; label: string; hint: string; icon: React.ReactNode }[] = [
    {
      id: 'cash', label: 'Efectivo', hint: 'CALCULA CAMBIO',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h20v10H2z"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>,
    },
    {
      id: 'card', label: 'Tarjeta', hint: 'TPV / DATÁFONO',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>,
    },
    {
      id: 'bizum', label: 'Bizum', hint: 'PAGO MÓVIL',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>,
    },
    {
      id: 'mixed', label: 'Mixto', hint: 'VARIOS MÉTODOS',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7h13M8 7l3-3M8 7l3 3"/><path d="M16 17H3M16 17l-3-3M16 17l-3 3"/></svg>,
    },
  ]

  return (
    <>
      {ticketId && (
        <TicketPreview
          ticketId={ticketId}
          onClose={() => { setTicketId(null); router.push('/tpv') }}
        />
      )}

      <div style={{ fontFamily: 'var(--font-plus-jakarta, system-ui, sans-serif)', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 }}>

        {/* TOTAL HERO */}
        <div style={{ background: '#14171d', borderRadius: 18, padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, fontWeight: 600, letterSpacing: 1, color: '#8b9099' }}>TOTAL A COBRAR</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cfd2d8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 46, fontWeight: 700, letterSpacing: -1.5, color: '#fff', lineHeight: 1 }}>{total}</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 22, color: '#6c727c' }}>€</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 13 }}>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#8b9099' }}>{count} ARTÍCULOS</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#4a505a' }}></span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#8b9099' }}>IVA INCLUIDO</span>
          </div>
        </div>

        {/* MODE SWITCH */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: '#ececee', border: '1px solid #e4e4e7', borderRadius: 13, padding: 4 }}>
          {([['full', 'Cuenta completa', <svg key="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>], ['split', 'Dividir cuenta', <svg key="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M5 8l-2 4 2 4M19 8l2 4-2 4"/></svg>]] as const).map(([m, label, icon]) => {
            const active = mode === m
            return (
              <button key={m} onClick={() => setMode(m)} style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '11px 0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: active ? '#fff' : 'transparent', color: active ? '#181b21' : '#82858d', boxShadow: active ? '0 1px 3px rgba(20,23,29,0.10)' : 'none', transition: 'all .15s ease' }}>
                {icon}{label}
              </button>
            )
          })}
        </div>

        {/* FULL MODE */}
        {mode === 'full' && (
          <>
            {/* Resumen */}
            <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: '#4d5159' }}>Resumen</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#b6b8bd' }}>{count} uds.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {order.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderTop: '1px solid #f2f2f3' }}>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, fontWeight: 700, color: '#6b6f77', background: '#f3f3f5', borderRadius: 7, padding: '3px 8px', flexShrink: 0 }}>×{item.quantity}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#25282f', flex: 1, minWidth: 0 }}>{item.product_name}</span>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: '#9a9da3' }}>{fmt(item.unit_price)} €</span>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, fontWeight: 700, color: '#1f2228', width: 64, textAlign: 'right' }}>{fmt(Number(item.total_price))}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderTop: '1.5px solid #f0f0f1', background: '#fafafb' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2c2f36' }}>Total</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 15, fontWeight: 700, color: '#1f2228' }}>{total} €</span>
              </div>
            </div>

            {/* Método de pago */}
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: '#4d5159', display: 'block', marginBottom: 10 }}>Método de pago</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {methodDefs.map(m => {
                  const on = method === m.id
                  return (
                    <button key={m.id} onClick={() => setMethod(m.id)} style={{ cursor: 'pointer', textAlign: 'left', background: on ? 'rgba(31,93,76,0.05)' : '#fff', border: `1.5px solid ${on ? ACCENT : '#e8e8ea'}`, borderRadius: 13, padding: 14, display: 'flex', alignItems: 'center', gap: 11, transition: 'all .14s ease' }}>
                      <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9, background: on ? ACCENT : '#f3f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: on ? '#fff' : '#7c7f86' }}>
                        {m.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: on ? '#14392f' : '#25282f' }}>{m.label}</div>
                        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5, color: '#a7a9af', marginTop: 1 }}>{m.hint}</div>
                      </div>
                      {on && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" strokeOpacity="0.25"/><path d="M8 12l2.5 2.5L16 9"/></svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Efectivo panel */}
            {method === 'cash' && (
              <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, padding: 18 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: '#4d5159' }}>Entregado en efectivo</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${cashFocus ? ACCENT : '#e6e6e8'}`, background: '#fcfcfd', borderRadius: 11, padding: '0 14px', height: 50, marginTop: 10, boxShadow: cashFocus ? '0 0 0 4px rgba(31,93,76,0.10)' : 'none', transition: 'all .15s ease' }}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 18, fontWeight: 600, color: '#b6b8bd' }}>€</span>
                  <input
                    value={given}
                    onChange={e => setGiven(e.target.value)}
                    onFocus={() => setCashFocus(true)}
                    onBlur={() => setCashFocus(false)}
                    inputMode="decimal"
                    placeholder="0,00"
                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: '#1b1e24', width: '100%', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {quickCash.map(q => (
                    <button key={q.label} onClick={q.action} style={{ flex: 1, cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)', fontSize: 12.5, fontWeight: 600, padding: '9px 0', borderRadius: 9, border: '1px solid #e8e8ea', background: '#fff', color: '#6b6f77' }}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0f0f1' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6b6f77' }}>Cambio a devolver</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 18, fontWeight: 700, color: changeNum > 0 ? ACCENT : '#c2c4c9' }}>{fmt(changeNum)} €</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* SPLIT MODE */}
        {mode === 'split' && (
          <>
            {/* Sub-mode + diners */}
            <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: '#f3f3f5', border: '1px solid #e9e9eb', borderRadius: 11, padding: 3 }}>
                {([['equal', 'Partes iguales'], ['items', 'Por artículos']] as const).map(([sm, label]) => {
                  const active = splitMode === sm
                  return (
                    <button key={sm} onClick={() => setSplitMode(sm)} style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '9px 0', borderRadius: 8, background: active ? '#fff' : 'transparent', color: active ? '#181b21' : '#82858d', boxShadow: active ? '0 1px 2px rgba(20,23,29,0.10)' : 'none', transition: 'all .14s ease' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#25282f' }}>Comensales</div>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#a7a9af', marginTop: 1 }}>¿ENTRE CUÁNTOS?</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f5f5f6', border: '1px solid #ededef', borderRadius: 11, padding: 4 }}>
                  <button onClick={() => setDiners(d => Math.max(2, d - 1))} style={{ width: 36, height: 36, border: 'none', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#4d5159', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14"/></svg>
                  </button>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 17, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{diners}</span>
                  <button onClick={() => setDiners(d => Math.min(8, d + 1))} style={{ width: 36, height: 36, border: 'none', borderRadius: 8, background: ACCENT, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Equal: per person */}
            {splitMode === 'equal' && (
              <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: '#4d5159' }}>Cada uno paga</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#b6b8bd' }}>{total} ÷ {diners}</span>
                </div>
                {dinerList.map(d => (
                  <div key={d.idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid #f2f2f3' }}>
                    <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, background: d.color + '1a', color: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700 }}>{d.initial}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#25282f', flex: 1 }}>{d.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 15, fontWeight: 700, color: '#1f2228' }}>{fmt(totalNum / diners)} €</span>
                  </div>
                ))}
              </div>
            )}

            {/* Items: assign units */}
            {splitMode === 'items' && (
              <>
                <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, padding: '16px 16px 6px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: '#4d5159' }}>Asigna cada artículo</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    {flatUnits.map((u, i) => (
                      <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid #f2f2f3', paddingTop: i === 0 ? 0 : 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 650, color: '#25282f', flex: 1 }}>{u.name} · ud. {i + 1}</span>
                          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12.5, fontWeight: 700, color: '#1f2228' }}>{fmt(u.price)} €</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {dinerList.map(d => {
                            const on = assign[i] === d.idx
                            return (
                              <button key={d.idx} onClick={() => setAssign(a => ({ ...a, [i]: d.idx }))} style={{ cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${on ? d.color : '#e8e8ea'}`, background: on ? d.color + '14' : '#fff', color: on ? d.color : '#82858d', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .12s ease' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }}></span>
                                {d.initial}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-person totals */}
                <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: '#4d5159' }}>Total por persona</span>
                  </div>
                  {dinerList.map(d => (
                    <div key={d.idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid #f2f2f3' }}>
                      <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, background: d.color + '1a', color: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700 }}>{d.initial}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#25282f', flex: 1 }}>{d.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#b6b8bd' }}>{perPersonCount[d.idx]} uds.</span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 15, fontWeight: 700, color: perPersonNum[d.idx] > 0 ? '#1f2228' : '#c2c4c9', width: 64, textAlign: 'right' }}>{fmt(perPersonNum[d.idx])} €</span>
                    </div>
                  ))}
                  {unassignedCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 18px', borderTop: '1px solid #f2f2f3', background: '#fdf8f1' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c0872b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.8 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/></svg>
                      <span style={{ fontSize: 12.5, color: '#8a6d33', flex: 1 }}>{unassignedCount} {unassignedCount === 1 ? 'artículo' : 'artículos'} sin asignar</span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, fontWeight: 700, color: '#8a6d33' }}>{fmt(unassignedNum)} €</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}
      </div>

      {/* FOOTER FIXED */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #ededef', padding: '14px 20px 18px', boxShadow: '0 -8px 24px rgba(20,23,29,0.05)', zIndex: 50 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', gap: 10 }}>
          <button
            style={{ width: 52, height: 54, flexShrink: 0, cursor: 'pointer', border: '1.5px solid #e6e6e8', borderRadius: 14, background: '#fff', color: '#4d5159', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .14s ease' }}
            title="Imprimir ticket"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid() || isPending}
            style={{ flex: 1, height: 54, cursor: 'pointer', border: 'none', borderRadius: 14, background: ACCENT, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, letterSpacing: 0.1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 22px rgba(31,93,76,0.24)', transition: 'filter .15s ease', opacity: (!isValid() || isPending) ? 0.5 : 1 }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
            {isPending ? 'Procesando...' : mode === 'full' ? `Confirmar cobro — ${total} €` : `Cobrar dividido — ${total} €`}
          </button>
        </div>
      </div>
    </>
  )
}
