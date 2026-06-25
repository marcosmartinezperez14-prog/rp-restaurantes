'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { KitchenItem, KitchenStatus } from '@/app/actions/cocina'
import { getKitchenItems, updateKitchenItemStatus } from '@/app/actions/cocina'

interface Props {
  initialItems: KitchenItem[]
  restaurantId: string
  refreshFn?: () => Promise<KitchenItem[]>
}

interface Ticket {
  orderId: string
  orderNumber: number
  tableName: string
  createdAt: string
  status: KitchenStatus
  items: KitchenItem[]
}

const STATUS_ORDER: KitchenStatus[] = ['pending', 'preparing', 'ready']

function minStatus(items: KitchenItem[]): KitchenStatus {
  for (const s of STATUS_ORDER) {
    if (items.some(i => i.status === s)) return s
  }
  return 'ready'
}

function groupTickets(items: KitchenItem[]): Ticket[] {
  const map = new Map<string, KitchenItem[]>()
  for (const item of items) {
    const arr = map.get(item.order_id) ?? []
    arr.push(item)
    map.set(item.order_id, arr)
  }
  return Array.from(map.values()).map(arr => ({
    orderId: arr[0].order_id,
    orderNumber: arr[0].order_number,
    tableName: arr[0].table_name,
    createdAt: arr.reduce((min, i) => i.created_at < min ? i.created_at : min, arr[0].created_at),
    status: minStatus(arr),
    items: arr,
  }))
}

const COLUMNS: { status: KitchenStatus; label: string; dot: string; emptyText: string }[] = [
  { status: 'pending',   label: 'Por hacer',   dot: '#c0872b', emptyText: 'Sin platos pendientes' },
  { status: 'preparing', label: 'Preparando',  dot: '#2f5fa6', emptyText: 'Nada en preparación' },
  { status: 'ready',     label: 'Listo',        dot: '#16876a', emptyText: 'Nada listo aún' },
]

const NEXT_STATUS: Partial<Record<KitchenStatus, KitchenStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
}

export default function CocinaClient({ initialItems, restaurantId, refreshFn }: Props) {
  const [items, setItems] = useState<KitchenItem[]>(initialItems)
  const [updating, setUpdating] = useState<string | null>(null)
  const [clock, setClock] = useState('')
  const [, startTransition] = useTransition()
  const doRefresh = refreshFn ?? getKitchenItems

  useEffect(() => {
    function tick() {
      const now = new Date()
      setClock(
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
      )
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`kds_${restaurantId}_${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          startTransition(async () => {
            const fresh = await doRefresh()
            setItems(fresh)
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurantId, doRefresh])

  const tickets = groupTickets(items)
  const todoCount = tickets.filter(t => t.status === 'pending').length
  const lateCount = tickets.filter(t => {
    if (t.status === 'ready') return false
    const mins = (Date.now() - new Date(t.createdAt).getTime()) / 60000
    return mins >= 12
  }).length

  async function handleAdvance(ticket: Ticket) {
    const next = NEXT_STATUS[ticket.status]
    if (!next) return
    const ids = ticket.items.map(i => i.id)
    setUpdating(ticket.orderId)
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: next } : i))
    await Promise.all(ids.map(id => updateKitchenItemStatus(id, next)))
    setUpdating(null)
  }

  return (
    <div style={{ height: '100vh', width: '100%', background: '#f6f6f7', display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* TOPBAR */}
      <header style={{ flex: 'none', background: '#fff', borderBottom: '1px solid #ededef', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#9a9da3', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Dashboard
          </Link>
          <span style={{ width: 1, height: 22, background: '#e7e7e9', display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#14171d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 2v7a2.5 2.5 0 0 1-5 0V2M6 2v20M17.5 2c-1.4 0-2.5 2.7-2.5 6 0 2.5 1 3.6 2 4v10"/></svg>
            </div>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px' }}>Cocina</span>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingRight: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c0872b', display: 'block' }} />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#71757c' }}>{todoCount} en cola</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c0492f', display: 'block', animation: lateCount > 0 ? 'kds-pulse 1.4s ease infinite' : undefined }} />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#71757c' }}>{lateCount} retrasados</span>
            </div>
          </div>
          <span style={{ width: 1, height: 22, background: '#e7e7e9', display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f4f4f5', border: '1px solid #e9e9eb', borderRadius: 10, padding: '7px 12px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c7f86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3 1.7"/></svg>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600, color: '#2c2f36' }}>{clock}</span>
          </div>
        </div>
      </header>

      <style>{`@keyframes kds-pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }`}</style>

      {/* BOARD */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, alignItems: 'start' }}>
          {COLUMNS.map(col => {
            const colTickets = tickets.filter(t => t.status === col.status)
            return (
              <div key={col.status} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e8e8ea', borderRadius: 13, padding: '12px 14px', position: 'sticky', top: 0, zIndex: 2 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.dot, flexShrink: 0, display: 'block' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.1px', color: '#1f2228' }}>{col.label}</span>
                  <span style={{
                    marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700,
                    color: colTickets.length ? '#1f2228' : '#b6b8bd',
                    background: colTickets.length ? '#f0f0f1' : '#f6f6f7',
                    minWidth: 26, height: 24, padding: '0 8px', borderRadius: 8,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {colTickets.length}
                  </span>
                </div>

                {/* Tickets */}
                {colTickets.length === 0 ? (
                  <EmptyState col={col} />
                ) : (
                  colTickets.map(ticket => (
                    <TicketCard
                      key={ticket.orderId}
                      ticket={ticket}
                      isUpdating={updating === ticket.orderId}
                      onAdvance={() => handleAdvance(ticket)}
                    />
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ElapsedTimer({ createdAt, status }: { createdAt: string; status: KitchenStatus }) {
  const [mins, setMins] = useState(() => (Date.now() - new Date(createdAt).getTime()) / 60000)

  useEffect(() => {
    const t = setInterval(() => {
      setMins((Date.now() - new Date(createdAt).getTime()) / 60000)
    }, 1000)
    return () => clearInterval(t)
  }, [createdAt])

  const isLate = status !== 'ready' && mins >= 12
  const isWarn = status !== 'ready' && mins >= 7 && mins < 12

  const timerFg = isLate ? '#c0492f' : isWarn ? '#c0872b' : '#71757c'
  const timerBg = isLate ? 'rgba(192,73,47,0.10)' : isWarn ? 'rgba(192,135,43,0.12)' : '#f3f3f5'

  const m = Math.floor(mins)
  const s = Math.floor((mins - m) * 60)
  const label = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: timerBg, borderRadius: 8, padding: '4px 9px' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={timerFg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2 1.5M9 2h6"/></svg>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, fontWeight: 700, color: timerFg }}>{label}</span>
    </span>
  )
}

function TicketCard({ ticket, isUpdating, onAdvance }: { ticket: Ticket; isUpdating: boolean; onAdvance: () => void }) {
  const mins = (Date.now() - new Date(ticket.createdAt).getTime()) / 60000
  const isLate = ticket.status !== 'ready' && mins >= 12

  const btnConfig = ticket.status === 'pending'
    ? { label: 'Empezar', bg: 'rgba(47,95,166,0.08)', fg: '#2f5fa6', icon: <path d="M5 3l14 9-14 9V3z"/> }
    : ticket.status === 'preparing'
    ? { label: 'Marcar listo', bg: 'var(--accent,#1f5d4c)', fg: '#fff', icon: <path d="M5 12l5 5L20 7"/> }
    : { label: 'Entregado', bg: '#f3f3f5', fg: '#71757c', icon: <><path d="M3 7l9 5 9-5"/><path d="M3 7v10l9 5 9-5V7l-9-5z"/></> }

  return (
    <div style={{ background: '#fff', border: `1px solid ${isLate ? 'rgba(192,73,47,0.45)' : '#e8e8ea'}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,23,29,0.04)' }}>
      {/* Head */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #f2f2f3' }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: '#1f2228' }}>#{ticket.orderNumber}</span>
          <span style={{ fontSize: 11.5, color: '#9a9da3', fontWeight: 500 }}>{ticket.tableName}</span>
        </div>
        <span style={{ marginLeft: 'auto' }}>
          <ElapsedTimer createdAt={ticket.createdAt} status={ticket.status} />
        </span>
      </div>

      {/* Items */}
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {ticket.items.map(it => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--accent,#1f5d4c)', flexShrink: 0 }}>{it.quantity}×</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#25282f' }}>{it.product_name}</span>
              {it.notes && (
                <span style={{ display: 'block', fontSize: 11.5, color: '#c0872b', fontWeight: 600, marginTop: 1 }}>› {it.notes}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action */}
      <button
        onClick={onAdvance}
        disabled={isUpdating}
        style={{
          width: '100%', border: 'none', borderTop: '1px solid #f2f2f3', cursor: isUpdating ? 'default' : 'pointer',
          background: btnConfig.bg, color: btnConfig.fg,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 700,
          padding: '11px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: isUpdating ? 0.5 : 1, transition: 'opacity .14s ease',
        }}
      >
        {!isUpdating && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {btnConfig.icon}
          </svg>
        )}
        {isUpdating ? '…' : btnConfig.label}
      </button>
    </div>
  )
}

function EmptyState({ col }: { col: typeof COLUMNS[number] }) {
  const icons: Record<KitchenStatus, React.ReactNode> = {
    pending: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    preparing: <path d="M8.5 2v7a2.5 2.5 0 0 1-5 0V2M6 2v20M17.5 2c-1.4 0-2.5 2.7-2.5 6 0 2.5 1 3.6 2 4v10"/>,
    ready: <><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/></>,
  }

  return (
    <div style={{ border: '1.5px dashed #e2e2e5', borderRadius: 14, padding: '36px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: '#f0f0f1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#c2c4c9' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {icons[col.status]}
        </svg>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#9a9da3' }}>{col.emptyText}</span>
    </div>
  )
}
