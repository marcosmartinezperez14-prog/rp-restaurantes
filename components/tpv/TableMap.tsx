'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ZoneWithTables, TableWithOrder, TableStatus } from '@/app/actions/tpv'
import { getZonesWithTables, createOrder, getOpenOrder, reserveTable, cancelReservation } from '@/app/actions/tpv'
import TableCard from './TableCard'
import NavDrawer from '@/components/NavDrawer'

type ActionMenu = { table: TableWithOrder; x: number; y: number }

export default function TableMap({
  initialData,
  restaurantId,
}: {
  initialData: ZoneWithTables[]
  restaurantId: string
}) {
  const [zones, setZones] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState<ActionMenu | null>(null)
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

  function handleTableClick(table: TableWithOrder, e: React.MouseEvent) {
    setError(null)
    if (table.status === 'occupied' || table.status === 'billing') {
      // Go straight to comanda
      startTransition(async () => {
        const result = await getOpenOrder(table.id)
        if (!result) { setError('No se encontró la comanda de esta mesa'); return }
        router.push(`/tpv/comanda/${result.orderId}`)
      })
      return
    }
    // Show action menu for free / reserved
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ table, x: rect.left, y: rect.bottom + 8 })
  }

  function closeMenu() { setMenu(null) }

  function handleOpenComanda() {
    if (!menu) return
    closeMenu()
    startTransition(async () => {
      const result = await createOrder(menu.table.id)
      if ('error' in result) { setError(`Error al abrir comanda: ${result.error}`); return }
      router.push(`/tpv/comanda/${result.orderId}`)
    })
  }

  function handleReserve() {
    if (!menu) return
    closeMenu()
    startTransition(async () => {
      const result = await reserveTable(menu.table.id)
      if (result.error) { setError(result.error); return }
      setZones(prev => prev.map(z => ({
        ...z,
        tables: z.tables.map(t => t.id === menu.table.id ? { ...t, status: 'reserved' as TableStatus } : t),
      })))
    })
  }

  function handleCancelReservation() {
    if (!menu) return
    closeMenu()
    startTransition(async () => {
      const result = await cancelReservation(menu.table.id)
      if (result.error) { setError(result.error); return }
      setZones(prev => prev.map(z => ({
        ...z,
        tables: z.tables.map(t => t.id === menu.table.id ? { ...t, status: 'free' as TableStatus } : t),
      })))
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
    <div className="min-h-screen bg-[#f4f6f9]" onClick={menu ? closeMenu : undefined}>
      <nav className="bg-white border-b border-[#e2e8f0] px-4 h-[52px] flex items-center gap-3 flex-shrink-0 shadow-sm">
        <NavDrawer />
        <span className="font-semibold text-[#0f172a] flex-1">TPV</span>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="px-3 py-1.5 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Actualizando...' : 'Actualizar'}
        </button>
      </nav>

      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-red-700 text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4 font-bold">✕</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {counts.occupied > 0 && (
            <div className="bg-[#fca5a5] text-[#b91c1c] px-3 py-1.5 rounded-lg text-sm font-semibold">{counts.occupied} Ocupadas</div>
          )}
          {counts.free > 0 && (
            <div className="bg-[#bbf7d0] text-[#15803d] px-3 py-1.5 rounded-lg text-sm font-semibold">{counts.free} Libres</div>
          )}
          {counts.reserved > 0 && (
            <div className="bg-[#fde68a] text-[#92400e] px-3 py-1.5 rounded-lg text-sm font-semibold">{counts.reserved} Reservadas</div>
          )}
          {counts.billing > 0 && (
            <div className="bg-[#93c5fd] text-[#1d4ed8] px-3 py-1.5 rounded-lg text-sm font-semibold">{counts.billing} Cobrando</div>
          )}
        </div>

        <div className="flex flex-col gap-8">
          {zones.map(zone => (
            <div key={zone.id}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: zone.color }} />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#64748b]">{zone.name}</h2>
                <div className="flex-1 h-px bg-[#e2e8f0]" />
              </div>
              <div className="flex flex-wrap gap-3">
                {zone.tables.map(table => (
                  <TableCard
                    key={table.id}
                    table={table}
                    onClick={(e) => handleTableClick(table, e)}
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

      {/* Action menu */}
      {menu && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#e2e8f0] overflow-hidden w-52"
          style={{ top: Math.min(menu.y, window.innerHeight - 160), left: Math.min(menu.x, window.innerWidth - 216) }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-4 py-2.5 border-b border-[#e2e8f0] bg-slate-50">
            <p className="text-xs font-bold text-[#64748b] uppercase tracking-wide">{menu.table.name}</p>
          </div>
          <button
            onClick={handleOpenComanda}
            disabled={isPending}
            className="w-full text-left px-4 py-3 text-sm font-semibold text-[#0f172a] hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors"
          >
            📋 Abrir comanda
          </button>
          {menu.table.status === 'free' && (
            <button
              onClick={handleReserve}
              disabled={isPending}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-[#0f172a] hover:bg-yellow-50 hover:text-yellow-700 disabled:opacity-50 transition-colors border-t border-[#e2e8f0]"
            >
              🔒 Reservar mesa
            </button>
          )}
          {menu.table.status === 'reserved' && (
            <button
              onClick={handleCancelReservation}
              disabled={isPending}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-[#0f172a] hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors border-t border-[#e2e8f0]"
            >
              ✕ Cancelar reserva
            </button>
          )}
        </div>
      )}
    </div>
  )
}
