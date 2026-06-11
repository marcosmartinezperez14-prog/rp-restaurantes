'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ZoneWithTables, TableWithOrder, TableStatus } from '@/app/actions/tpv'
import {
  getZonesWithTables, getOpenOrder,
  reserveTable, cancelReservation,
  deleteTable, deleteZone,
} from '@/app/actions/tpv'
import { useOfflineFetch } from '@/lib/offline/useOfflineFetch'
import { OfflineIndicator } from '@/components/offline/OfflineIndicator'
import Link from 'next/link'
import TableCard from './TableCard'
import AddTableModal from './AddTableModal'
import AddZoneModal from './AddZoneModal'

type ActionMenu = { table: TableWithOrder; x: number; y: number }
type EditModal = { type: 'addTable'; zoneId: string } | { type: 'addZone' }

export default function TableMap({
  initialData,
  restaurantId,
  canEdit = false,
}: {
  initialData: ZoneWithTables[]
  restaurantId: string
  canEdit?: boolean
}) {
  const [zones, setZones] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState<ActionMenu | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const router = useRouter()
  const { offlineFetch, isOnline, pendingCount } = useOfflineFetch()

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
    if (isEditing) return
    setError(null)
    if (table.status === 'occupied' || table.status === 'billing') {
      startTransition(async () => {
        const result = await getOpenOrder(table.id)
        if (!result) { setError('No se encontró la comanda de esta mesa'); return }
        router.push(`/tpv/comanda/${result.orderId}`)
      })
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ table, x: rect.left, y: rect.bottom + 8 })
  }

  function closeMenu() { setMenu(null) }

  function handleOpenComanda() {
    if (!menu) return
    closeMenu()
    const tableId = menu.table.id
    startTransition(async () => {
      const result = await offlineFetch({
        type: 'create_order',
        endpoint: '/api/tpv/orders',
        method: 'POST',
        payload: { tableId },
      })
      if (!result.ok) { setError(`Error al abrir comanda: ${result.error ?? 'Error desconocido'}`); return }
      if (result.offline) {
        // Operación encolada — actualización optimista: marcar mesa como ocupada
        setZones(prev => prev.map(z => ({
          ...z,
          tables: z.tables.map(t => t.id === tableId ? { ...t, status: 'occupied' as TableStatus } : t),
        })))
        return
      }
      const data = result.data as { orderId: string }
      router.push(`/tpv/comanda/${data.orderId}`)
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

  function handleDeleteTable(tableId: string) {
    startTransition(async () => {
      const res = await deleteTable(tableId)
      if (res.error) { setError(res.error); return }
      setZones(prev => prev.map(z => ({
        ...z,
        tables: z.tables.filter(t => t.id !== tableId),
      })))
    })
  }

  function handleDeleteZone(zoneId: string) {
    startTransition(async () => {
      const res = await deleteZone(zoneId)
      if (res.error) { setError(res.error); return }
      setZones(prev => prev.filter(z => z.id !== zoneId))
    })
  }

  function handleTableCreated(zoneId: string, table: TableWithOrder) {
    setZones(prev => prev.map(z =>
      z.id === zoneId ? { ...z, tables: [...z.tables, table] } : z
    ))
  }

  function handleZoneCreated(zone: ZoneWithTables) {
    setZones(prev => [...prev, zone])
  }

  const allTables = zones.flatMap(z => z.tables)
  const counts = {
    occupied: allTables.filter(t => t.status === 'occupied').length,
    free:     allTables.filter(t => t.status === 'free').length,
    billing:  allTables.filter(t => t.status === 'billing').length,
    reserved: allTables.filter(t => t.status === 'reserved').length,
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)]" onClick={menu ? closeMenu : undefined}>
      <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
      <nav className={`border-b px-4 h-[52px] flex items-center gap-3 flex-shrink-0 shadow-sm transition-colors ${
        isEditing ? 'bg-amber-50 border-amber-200' : 'bg-[var(--bg-surface)] border-[var(--border)]'
      }`}>
        <Link href="/dashboard" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          ← Dashboard
        </Link>
        <span className="text-[var(--border)]">|</span>
        <span className={`font-semibold flex-1 ${isEditing ? 'text-amber-700' : 'text-[var(--text-primary)]'}`}>
          {isEditing ? 'Editando mapa' : 'TPV'}
        </span>
        {!isEditing && (
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-[var(--bg-surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:opacity-80 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Actualizando...' : 'Actualizar'}
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => { setIsEditing(e => !e); setError(null) }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
              isEditing
                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                : 'bg-[var(--bg-surface-hover)] border-[var(--border)] text-[var(--text-secondary)] hover:opacity-80'
            }`}
          >
            {isEditing ? '✓ Salir de edición' : 'Editar mapa'}
          </button>
        )}
      </nav>

      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-red-700 text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4 font-bold">✕</button>
          </div>
        )}

        {!isEditing && (
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
        )}

        <div className="flex flex-col gap-8">
          {zones.map(zone => {
            const zoneHasTables = zone.tables.length > 0
            return (
              <div key={zone.id}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: zone.color }} />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{zone.name}</h2>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  {isEditing && (
                    <button
                      onClick={() => handleDeleteZone(zone.id)}
                      disabled={zoneHasTables || isPending}
                      title={zoneHasTables ? 'Elimina las mesas primero' : 'Eliminar zona'}
                      className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm px-2 py-0.5 rounded transition-colors"
                    >
                      🗑
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {zone.tables.map(table => (
                    <TableCard
                      key={table.id}
                      table={table}
                      onClick={(e) => handleTableClick(table, e)}
                      disabled={isPending}
                      isEditing={isEditing}
                      onDelete={() => handleDeleteTable(table.id)}
                    />
                  ))}
                  {isEditing && (
                    <button
                      onClick={() => setEditModal({ type: 'addTable', zoneId: zone.id })}
                      className="border-2 border-dashed border-[var(--border)] rounded-[10px] min-w-[100px] min-h-[90px] flex items-center justify-center text-[var(--text-muted)] hover:border-blue-300 hover:text-blue-500 transition-colors text-sm font-medium"
                    >
                      + Mesa
                    </button>
                  )}
                  {zone.tables.length === 0 && !isEditing && (
                    <p className="text-sm text-[var(--text-muted)]">Sin mesas en esta zona</p>
                  )}
                </div>
              </div>
            )
          })}

          {isEditing && (
            <button
              onClick={() => setEditModal({ type: 'addZone' })}
              className="border-2 border-dashed border-[var(--border)] rounded-xl py-4 flex items-center justify-center gap-2 text-[var(--text-muted)] hover:border-blue-300 hover:text-blue-500 transition-colors text-sm font-medium"
            >
              + Nueva zona
            </button>
          )}

          {zones.length === 0 && (
            <p className="text-center text-[var(--text-muted)] py-12">No hay zonas configuradas</p>
          )}
        </div>
      </div>

      {/* Action menu (normal mode) */}
      {menu && !isEditing && (
        <div
          className="fixed z-50 bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border)] overflow-hidden w-52"
          style={{ top: Math.min(menu.y, window.innerHeight - 160), left: Math.min(menu.x, window.innerWidth - 216) }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-surface-hover)]">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">{menu.table.name}</p>
          </div>
          <button
            onClick={handleOpenComanda}
            disabled={isPending}
            className="w-full text-left px-4 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors"
          >
            📋 Abrir comanda
          </button>
          {menu.table.status === 'free' && (
            <button
              onClick={handleReserve}
              disabled={isPending}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-yellow-50 hover:text-yellow-700 disabled:opacity-50 transition-colors border-t border-[var(--border)]"
            >
              🔒 Reservar mesa
            </button>
          )}
          {menu.table.status === 'reserved' && (
            <button
              onClick={handleCancelReservation}
              disabled={isPending}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors border-t border-[var(--border)]"
            >
              ✕ Cancelar reserva
            </button>
          )}
        </div>
      )}

      {/* Edit modals */}
      {editModal?.type === 'addTable' && (
        <AddTableModal
          zones={zones}
          defaultZoneId={editModal.zoneId}
          onClose={() => setEditModal(null)}
          onCreated={handleTableCreated}
        />
      )}
      {editModal?.type === 'addZone' && (
        <AddZoneModal
          onClose={() => setEditModal(null)}
          onCreated={handleZoneCreated}
        />
      )}
    </div>
  )
}
