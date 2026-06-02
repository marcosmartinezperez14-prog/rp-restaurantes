# TPV Edit Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable edit mode to the TPV that lets staff add/remove tables and zones directly from the table map.

**Architecture:** `isEditing` boolean state lives in `TableMap`. Four new Server Actions handle mutations with ownership checks. Two new modal components (`AddTableModal`, `AddZoneModal`) handle creation forms. `TableCard` gains an `isEditing` prop that renders a ✕ overlay. All state updates are optimistic (local) — no full refetch needed.

**Tech Stack:** Next.js 16.2.6 · React 19 · TypeScript 5 strict · Tailwind v4 · @supabase/ssr v0.10.3

> **Verification per task:** `npx tsc --noEmit`. Final: `npm run build`.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `app/actions/tpv.ts` | Modify | Add `addTable`, `deleteTable`, `addZone`, `deleteZone` |
| `components/tpv/TableCard.tsx` | Modify | Add `isEditing` prop + ✕ overlay |
| `components/tpv/AddTableModal.tsx` | Create | CC: form to create a table (name, capacity, zone) |
| `components/tpv/AddZoneModal.tsx` | Create | CC: form to create a zone (name, color swatch) |
| `components/tpv/TableMap.tsx` | Modify | Edit mode toggle, pass `isEditing`, render controls |

---

## Task 1: Server Actions — add/delete table and zone

**Files:**
- Modify: `app/actions/tpv.ts`

- [ ] **Step 1: Add the four actions at the end of `app/actions/tpv.ts`**

Append after the last export in the file:

```typescript
export async function addTable(params: {
  name: string
  capacity: number
  zoneId: string
}): Promise<{ table: TableWithOrder } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!params.name.trim()) return { error: 'El nombre es obligatorio' }
  if (params.capacity < 1) return { error: 'La capacidad debe ser al menos 1' }

  const { data: posData } = await supabase
    .from('tables')
    .select('position')
    .eq('zone_id', params.zoneId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = posData && posData.length > 0 ? (posData[0].position ?? 0) + 1 : 1

  const { data, error } = await supabase
    .from('tables')
    .insert({
      restaurant_id: restaurantId,
      zone_id: params.zoneId,
      name: params.name.trim(),
      capacity: params.capacity,
      status: 'free',
      is_active: true,
      position: nextPosition,
    })
    .select('id, name, capacity, status')
    .single()

  if (error || !data) return { error: error?.message ?? 'No se pudo crear la mesa' }

  return {
    table: {
      id: data.id,
      name: data.name,
      capacity: data.capacity,
      status: data.status as TableStatus,
    },
  }
}

export async function deleteTable(tableId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data: table } = await supabase
    .from('tables')
    .select('status')
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!table) return { error: 'Mesa no encontrada' }
  if (table.status !== 'free') return { error: 'Cierra la comanda antes de eliminar la mesa' }

  const { error } = await supabase
    .from('tables')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}

export async function addZone(params: {
  name: string
  color: string
}): Promise<{ zone: ZoneWithTables } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!params.name.trim()) return { error: 'El nombre es obligatorio' }

  const { data: posData } = await supabase
    .from('zones')
    .select('position')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = posData && posData.length > 0 ? (posData[0].position ?? 0) + 1 : 1

  const { data, error } = await supabase
    .from('zones')
    .insert({
      restaurant_id: restaurantId,
      name: params.name.trim(),
      color: params.color,
      is_active: true,
      position: nextPosition,
    })
    .select('id, name, color')
    .single()

  if (error || !data) return { error: error?.message ?? 'No se pudo crear la zona' }

  return { zone: { id: data.id, name: data.name, color: data.color, tables: [] } }
}

export async function deleteZone(zoneId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data: activeTables } = await supabase
    .from('tables')
    .select('id')
    .eq('zone_id', zoneId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)

  if (activeTables && activeTables.length > 0) {
    return { error: 'Elimina todas las mesas de la zona antes de borrarla' }
  }

  const { error } = await supabase
    .from('zones')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', zoneId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add app/actions/tpv.ts
git commit -m "feat: add addTable, deleteTable, addZone, deleteZone server actions"
```

---

## Task 2: TableCard — overlay ✕ en modo edición

**Files:**
- Modify: `components/tpv/TableCard.tsx`

- [ ] **Step 1: Reemplazar `components/tpv/TableCard.tsx` completo**

```tsx
'use client'

import type { TableWithOrder, TableStatus } from '@/app/actions/tpv'

const STATUS_CONFIG: Record<TableStatus, { label: string; bg: string; text: string; border: string }> = {
  free:     { label: 'Libre',     bg: '#bbf7d0', text: '#15803d', border: '#22c55e' },
  occupied: { label: 'Ocupada',   bg: '#fca5a5', text: '#b91c1c', border: '#ef4444' },
  reserved: { label: 'Reservada', bg: '#fde68a', text: '#92400e', border: '#eab308' },
  billing:  { label: 'Cobrando',  bg: '#93c5fd', text: '#1d4ed8', border: '#3b82f6' },
}

function formatElapsed(openedAt: string): string {
  const diff = Date.now() - new Date(openedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function TableCard({
  table,
  onClick,
  disabled,
  isEditing,
  onDelete,
}: {
  table: TableWithOrder
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  isEditing?: boolean
  onDelete?: () => void
}) {
  const cfg = STATUS_CONFIG[table.status]
  const showExtra = (table.status === 'occupied' || table.status === 'billing') && table.openOrder
  const canDelete = isEditing && table.status === 'free'

  return (
    <div className="relative">
      <button
        onClick={isEditing ? undefined : onClick}
        disabled={disabled || isEditing}
        style={{
          borderColor: cfg.border,
          borderWidth: '1.5px',
          borderStyle: 'solid',
          borderRadius: '10px',
          minWidth: '100px',
          minHeight: '90px',
        }}
        className="bg-white p-3 flex flex-col gap-1 text-left hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        <span className="font-bold text-[#0f172a] text-sm leading-tight">{table.name}</span>
        <span className="text-[#64748b] text-xs">{table.capacity} pers.</span>
        <span
          style={{ background: cfg.bg, color: cfg.text, borderRadius: '4px' }}
          className="text-[10px] font-semibold uppercase px-1.5 py-0.5 mt-auto self-start"
        >
          {cfg.label}
        </span>
        {showExtra && (
          <div className="text-[10px] text-[#64748b] mt-0.5">
            <div>{formatElapsed(table.openOrder!.opened_at)}</div>
            <div className="font-semibold text-[#0f172a]">{Number(table.openOrder!.total).toFixed(2)} €</div>
          </div>
        )}
      </button>

      {isEditing && (
        <button
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? 'Eliminar mesa' : 'Cierra la comanda primero'}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-500 text-white hover:bg-red-600"
        >
          ✕
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add components/tpv/TableCard.tsx
git commit -m "feat: add isEditing prop and delete overlay to TableCard"
```

---

## Task 3: AddTableModal

**Files:**
- Create: `components/tpv/AddTableModal.tsx`

- [ ] **Step 1: Crear `components/tpv/AddTableModal.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ZoneWithTables, TableWithOrder } from '@/app/actions/tpv'
import { addTable } from '@/app/actions/tpv'

interface Props {
  zones: ZoneWithTables[]
  defaultZoneId?: string
  onClose: () => void
  onCreated: (zoneId: string, table: TableWithOrder) => void
}

export default function AddTableModal({ zones, defaultZoneId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('4')
  const [zoneId, setZoneId] = useState(defaultZoneId ?? zones[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const cap = parseInt(capacity)
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (isNaN(cap) || cap < 1) { setError('La capacidad debe ser al menos 1'); return }
    if (!zoneId) { setError('Selecciona una zona'); return }

    setError(null)
    startTransition(async () => {
      const res = await addTable({ name: name.trim(), capacity: cap, zoneId })
      if ('error' in res) { setError(res.error); return }
      onCreated(zoneId, res.table)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-bold text-[#0f172a]">Nueva mesa</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Zona</span>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)}
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 bg-white">
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Nombre</span>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Mesa 5, Barra 1"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Capacidad (personas)</span>
            <input value={capacity} onChange={e => setCapacity(e.target.value)}
              type="number" min="1"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
          </label>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Creando...' : 'Crear mesa'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add components/tpv/AddTableModal.tsx
git commit -m "feat: add AddTableModal component"
```

---

## Task 4: AddZoneModal

**Files:**
- Create: `components/tpv/AddZoneModal.tsx`

- [ ] **Step 1: Crear `components/tpv/AddZoneModal.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ZoneWithTables } from '@/app/actions/tpv'
import { addZone } from '@/app/actions/tpv'

const COLORS = [
  { hex: '#64748b', label: 'Gris' },
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#22c55e', label: 'Verde' },
  { hex: '#f59e0b', label: 'Ámbar' },
  { hex: '#ef4444', label: 'Rojo' },
  { hex: '#a855f7', label: 'Morado' },
]

interface Props {
  onClose: () => void
  onCreated: (zone: ZoneWithTables) => void
}

export default function AddZoneModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[1].hex)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }

    setError(null)
    startTransition(async () => {
      const res = await addZone({ name: name.trim(), color })
      if ('error' in res) { setError(res.error); return }
      onCreated(res.zone)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-bold text-[#0f172a]">Nueva zona</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Nombre</span>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Terraza, Salón, Barra"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Color</span>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setColor(c.hex)}
                  style={{ background: c.hex }}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c.hex ? 'ring-2 ring-offset-2 ring-[#0f172a] scale-110' : 'hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Creando...' : 'Crear zona'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add components/tpv/AddZoneModal.tsx
git commit -m "feat: add AddZoneModal component"
```

---

## Task 5: TableMap — modo edición completo

**Files:**
- Modify: `components/tpv/TableMap.tsx`

- [ ] **Step 1: Reemplazar `components/tpv/TableMap.tsx` completo**

```tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ZoneWithTables, TableWithOrder, TableStatus } from '@/app/actions/tpv'
import {
  getZonesWithTables, createOrder, getOpenOrder,
  reserveTable, cancelReservation,
  addTable, deleteTable, addZone, deleteZone,
} from '@/app/actions/tpv'
import TableCard from './TableCard'
import NavDrawer from '@/components/NavDrawer'
import AddTableModal from './AddTableModal'
import AddZoneModal from './AddZoneModal'

type ActionMenu = { table: TableWithOrder; x: number; y: number }
type EditModal = { type: 'addTable'; zoneId: string } | { type: 'addZone' }

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
  const [isEditing, setIsEditing] = useState(false)
  const [editModal, setEditModal] = useState<EditModal | null>(null)
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
    <div className="min-h-screen bg-[#f4f6f9]" onClick={menu ? closeMenu : undefined}>
      <nav className={`border-b px-4 h-[52px] flex items-center gap-3 flex-shrink-0 shadow-sm transition-colors ${
        isEditing ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#e2e8f0]'
      }`}>
        <NavDrawer />
        <span className={`font-semibold flex-1 ${isEditing ? 'text-amber-700' : 'text-[#0f172a]'}`}>
          {isEditing ? 'Editando mapa' : 'TPV'}
        </span>
        {!isEditing && (
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Actualizando...' : 'Actualizar'}
          </button>
        )}
        <button
          onClick={() => { setIsEditing(e => !e); setError(null) }}
          className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
            isEditing
              ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
              : 'bg-slate-100 border-[#e2e8f0] text-[#64748b] hover:bg-slate-200'
          }`}
        >
          {isEditing ? '✓ Salir de edición' : 'Editar mapa'}
        </button>
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
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#64748b]">{zone.name}</h2>
                  <div className="flex-1 h-px bg-[#e2e8f0]" />
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
                      className="border-2 border-dashed border-[#e2e8f0] rounded-[10px] min-w-[100px] min-h-[90px] flex items-center justify-center text-[#94a3b8] hover:border-blue-300 hover:text-blue-500 transition-colors text-sm font-medium"
                    >
                      + Mesa
                    </button>
                  )}
                  {zone.tables.length === 0 && !isEditing && (
                    <p className="text-sm text-[#94a3b8]">Sin mesas en esta zona</p>
                  )}
                </div>
              </div>
            )
          })}

          {isEditing && (
            <button
              onClick={() => setEditModal({ type: 'addZone' })}
              className="border-2 border-dashed border-[#e2e8f0] rounded-xl py-4 flex items-center justify-center gap-2 text-[#94a3b8] hover:border-blue-300 hover:text-blue-500 transition-colors text-sm font-medium"
            >
              + Nueva zona
            </button>
          )}

          {zones.length === 0 && (
            <p className="text-center text-[#94a3b8] py-12">No hay zonas configuradas</p>
          )}
        </div>
      </div>

      {/* Action menu (normal mode) */}
      {menu && !isEditing && (
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
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add components/tpv/TableMap.tsx
git commit -m "feat: add edit mode to TableMap (add/delete tables and zones)"
```

---

## Task 6: Build final

- [ ] **Step 1: Build de producción**

```powershell
npm run build
```

Resultado esperado: `✓ Compiled successfully` con las rutas `/tpv`, `/tpv/comanda/[orderId]`, `/tpv/cobro/[orderId]`.

- [ ] **Step 2: Commit final si hay cambios pendientes**

```powershell
git add -A
git commit -m "feat: TPV edit mode complete — add/remove tables and zones"
```

---

## Self-Review

| Requisito del spec | Tarea |
|---|---|
| Botón "Editar mapa" → activa modo edición | Task 5 (nav con `isEditing`) |
| Nav cambia a ámbar en modo edición | Task 5 |
| TableCard muestra ✕ en modo edición | Task 2 |
| ✕ deshabilitado si mesa no libre | Task 2 (`canDelete`) |
| `deleteTable` soft-delete + ownership check | Task 1 |
| Botón "+ Mesa" por zona en modo edición | Task 5 |
| `AddTableModal` con zona, nombre, capacidad | Task 3 |
| `addTable` server action + ownership check | Task 1 |
| Botón 🗑 en zona deshabilitado si tiene mesas | Task 5 |
| `deleteZone` soft-delete + check de mesas activas | Task 1 |
| Botón "+ Nueva zona" al final | Task 5 |
| `AddZoneModal` con nombre + 6 colores | Task 4 |
| `addZone` server action + ownership check | Task 1 |
| Errores en banner rojo existente | Task 5 |
| Click en mesa bloqueado en modo edición | Task 5 (`handleTableClick` early return) |
| Actualización local optimista (sin refetch) | Task 5 (handlers `handleTableCreated`, etc.) |
