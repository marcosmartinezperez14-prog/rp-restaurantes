'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ZoneWithTables, TableWithOrder, TableStatus } from '@/app/actions/tpv'
import { getZonesWithTables, createOrder, getOpenOrder } from '@/app/actions/tpv'
import TableCard from './TableCard'

export default function TableMap({
  initialData,
  restaurantId,
}: {
  initialData: ZoneWithTables[]
  restaurantId: string
}) {
  const [zones, setZones] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`tpv:tables:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const updated = payload.new as { id: string; status: TableStatus }
          setZones(prev =>
            prev.map(zone => ({
              ...zone,
              tables: zone.tables.map(t =>
                t.id === updated.id ? { ...t, status: updated.status } : t
              ),
            }))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [restaurantId])

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getZonesWithTables()
      setZones(fresh)
    })
  }

  function handleTableClick(table: TableWithOrder) {
    if (isPending || activeTableId === table.id) return
    setActiveTableId(table.id)
    startTransition(async () => {
      try {
        if (table.status === 'free' || table.status === 'reserved') {
          const result = await createOrder(table.id)
          if ('error' in result) { setActiveTableId(null); return }
          router.push(`/tpv/comanda/${result.orderId}`)
        } else {
          const result = await getOpenOrder(table.id)
          if (!result) { setActiveTableId(null); return }
          router.push(`/tpv/comanda/${result.orderId}`)
        }
      } catch {
        setActiveTableId(null)
      }
    })
  }

  const allTables = zones.flatMap(z => z.tables)
  const counts = {
    occupied: allTables.filter(t => t.status === 'occupied').length,
    free:     allTables.filter(t => t.status === 'free').length,
    billing:  allTables.filter(t => t.status === 'billing').length,
    reserved: allTables.filter(t => t.status === 'reserved').length,
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <nav className="bg-white border-b border-[#e2e8f0] px-6 h-[52px] flex items-center justify-between flex-shrink-0 shadow-sm">
        <span className="font-semibold text-[#0f172a]">RP Restaurantes · TPV</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Actualizando...' : 'Actualizar'}
          </button>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </nav>
      <div className="p-6">

      <div className="flex flex-wrap gap-2 mb-6">
        {counts.occupied > 0 && (
          <div className="bg-[#fca5a5] text-[#b91c1c] px-3 py-1.5 rounded-lg text-sm font-semibold">
            {counts.occupied} Ocupadas
          </div>
        )}
        {counts.free > 0 && (
          <div className="bg-[#bbf7d0] text-[#15803d] px-3 py-1.5 rounded-lg text-sm font-semibold">
            {counts.free} Libres
          </div>
        )}
        {counts.billing > 0 && (
          <div className="bg-[#93c5fd] text-[#1d4ed8] px-3 py-1.5 rounded-lg text-sm font-semibold">
            {counts.billing} Cobrando
          </div>
        )}
        {counts.reserved > 0 && (
          <div className="bg-[#fde68a] text-[#92400e] px-3 py-1.5 rounded-lg text-sm font-semibold">
            {counts.reserved} Reservadas
          </div>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {zones.map(zone => (
          <div key={zone.id}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: zone.color }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#64748b]">
                {zone.name}
              </h2>
              <div className="flex-1 h-px bg-[#e2e8f0]" />
            </div>
            <div className="flex flex-wrap gap-3">
              {zone.tables.map(table => (
                <TableCard
                  key={table.id}
                  table={table}
                  onClick={() => handleTableClick(table)}
                  disabled={isPending}
                />
              ))}
              {zone.tables.length === 0 && (
                <p className="text-sm text-[#94a3b8]">Sin mesas en esta zona</p>
              )}
            </div>
          </div>
        ))}
        {zones.length === 0 && (
          <p className="text-center text-[#94a3b8] py-12">No hay zonas configuradas</p>
        )}
      </div>
      </div>
    </div>
  )
}
