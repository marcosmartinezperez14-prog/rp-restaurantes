# Página de Movimientos de Stock Global — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the sub-page `/productos/movimientos` that shows all stock movements of the restaurant with filters (type, product, date range), summary stats cards, and server-side pagination.

**Architecture:** Server Component (`page.tsx`) loads initial data via a new `getMovimientosGlobal` server action, then passes it to a Client Component (`MovimientosClient`) that manages filter state and re-fetches on every change. Follows the exact same pattern as `ProductsClient.tsx` / `app/productos/page.tsx`.

**Tech Stack:** Next.js App Router, Supabase JS v2, TypeScript, Tailwind CSS.

---

### Task 1: Types + `getMovimientosGlobal` server action

**Files:**
- Modify: `app/actions/productos.ts`

- [ ] **Step 1: Add `MovimientoGlobal` and `StockStats` types**

In `app/actions/productos.ts`, after the `StockMovement` type block (around line 33), insert:

```typescript
export type MovimientoGlobal = {
  id: string
  product_id: string
  product_name: string
  type: 'compra' | 'venta' | 'ajuste' | 'merma'
  quantity: number
  cost_price: number | null
  purchase_date: string | null
  notes: string | null
  created_at: string
}

export type StockStats = {
  compras: { total: number; count: number }
  ventas:  { total: number; count: number }
  ajustes: { total: number; count: number }
  mermas:  { total: number; count: number }
}
```

- [ ] **Step 2: Add `getMovimientosGlobal` at the end of `app/actions/productos.ts`**

```typescript
export async function getMovimientosGlobal(params: {
  tipo?: 'compra' | 'venta' | 'ajuste' | 'merma'
  productoId?: string
  fechaDesde?: string   // 'YYYY-MM-DD'
  fechaHasta?: string   // 'YYYY-MM-DD'
  page: number
  pageSize?: number
}): Promise<{ movements: MovimientoGlobal[]; total: number; stats: StockStats }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const pageSize = params.pageSize ?? 50
  const from = (params.page - 1) * pageSize
  const to = from + pageSize - 1

  // Lightweight query for stats + total count (no product join, no range limit)
  let statsQ = supabase
    .from('stock_movements')
    .select('type, quantity')
    .eq('restaurant_id', restaurantId)
    .limit(10000)

  if (params.tipo)       statsQ = statsQ.eq('type', params.tipo)
  if (params.productoId) statsQ = statsQ.eq('product_id', params.productoId)
  if (params.fechaDesde) statsQ = statsQ.gte('created_at', params.fechaDesde)
  if (params.fechaHasta) statsQ = statsQ.lte('created_at', `${params.fechaHasta}T23:59:59`)

  const { data: statsData } = await statsQ

  const stats: StockStats = {
    compras: { total: 0, count: 0 },
    ventas:  { total: 0, count: 0 },
    ajustes: { total: 0, count: 0 },
    mermas:  { total: 0, count: 0 },
  }
  const keyMap: Record<string, keyof StockStats> = {
    compra: 'compras', venta: 'ventas', ajuste: 'ajustes', merma: 'mermas',
  }
  for (const row of (statsData ?? [])) {
    const key = keyMap[row.type]
    if (key) {
      stats[key].total += Number(row.quantity)
      stats[key].count += 1
    }
  }

  // Paginated query with product name join
  let dataQ = supabase
    .from('stock_movements')
    .select('id, product_id, type, quantity, cost_price, purchase_date, notes, created_at, products(name)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.tipo)       dataQ = dataQ.eq('type', params.tipo)
  if (params.productoId) dataQ = dataQ.eq('product_id', params.productoId)
  if (params.fechaDesde) dataQ = dataQ.gte('created_at', params.fechaDesde)
  if (params.fechaHasta) dataQ = dataQ.lte('created_at', `${params.fechaHasta}T23:59:59`)

  const { data } = await dataQ

  const movements: MovimientoGlobal[] = (data ?? []).map(m => ({
    id: m.id,
    product_id: m.product_id,
    product_name: (m.products as { name: string } | null)?.name ?? '—',
    type: m.type as MovimientoGlobal['type'],
    quantity: Number(m.quantity),
    cost_price: m.cost_price !== null ? Number(m.cost_price) : null,
    purchase_date: m.purchase_date ?? null,
    notes: m.notes ?? null,
    created_at: m.created_at,
  }))

  return { movements, total: (statsData ?? []).length, stats }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `app/actions/productos.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/actions/productos.ts
git commit -m "feat: add getMovimientosGlobal action and MovimientoGlobal/StockStats types"
```

---

### Task 2: Server Component `/productos/movimientos/page.tsx`

**Files:**
- Create: `app/productos/movimientos/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMovimientosGlobal, getProductos } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import MovimientosClient from './MovimientosClient'

export default async function MovimientosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [initialData, products] = await Promise.all([
    getMovimientosGlobal({ page: 1 }),
    getProductos(),
  ])

  return (
    <AppShell title="Movimientos de stock">
      <MovimientosClient initialData={initialData} products={products} />
    </AppShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: one error about missing `MovimientosClient` (not created yet) — all else clean.

- [ ] **Step 3: Commit**

```bash
git add app/productos/movimientos/page.tsx
git commit -m "feat: add /productos/movimientos server component page"
```

---

### Task 3: Client Component `MovimientosClient.tsx`

**Files:**
- Create: `app/productos/movimientos/MovimientosClient.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { MovimientoGlobal, StockStats, ProductoConCategoria } from '@/app/actions/productos'
import { getMovimientosGlobal } from '@/app/actions/productos'

const PAGE_SIZE = 50

const TYPE_CONFIG: Record<MovimientoGlobal['type'], {
  label: string; badge: string; sign: string; amountColor: string
}> = {
  compra: { label: 'Compra', badge: 'bg-green-50 text-green-700',  sign: '+', amountColor: 'text-green-700' },
  venta:  { label: 'Venta',  badge: 'bg-blue-50 text-blue-700',    sign: '-', amountColor: 'text-blue-700'  },
  ajuste: { label: 'Ajuste', badge: 'bg-amber-50 text-amber-700',  sign: '±', amountColor: 'text-amber-700' },
  merma:  { label: 'Merma',  badge: 'bg-red-50 text-red-600',      sign: '-', amountColor: 'text-red-600'   },
}

interface Props {
  initialData: { movements: MovimientoGlobal[]; total: number; stats: StockStats }
  products: ProductoConCategoria[]
}

export default function MovimientosClient({ initialData, products }: Props) {
  const [data, setData] = useState(initialData)
  const [tipo, setTipo] = useState('')
  const [productoId, setProductoId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  function fetchData(p: {
    tipo: string; productoId: string; fechaDesde: string; fechaHasta: string; page: number
  }) {
    setPage(p.page)
    startTransition(async () => {
      const fresh = await getMovimientosGlobal({
        tipo: (p.tipo as MovimientoGlobal['type']) || undefined,
        productoId: p.productoId || undefined,
        fechaDesde: p.fechaDesde || undefined,
        fechaHasta: p.fechaHasta || undefined,
        page: p.page,
      })
      setData(fresh)
    })
  }

  function handleTipo(v: string) {
    setTipo(v)
    fetchData({ tipo: v, productoId, fechaDesde, fechaHasta, page: 1 })
  }
  function handleProducto(v: string) {
    setProductoId(v)
    fetchData({ tipo, productoId: v, fechaDesde, fechaHasta, page: 1 })
  }
  function handleFechaDesde(v: string) {
    setFechaDesde(v)
    fetchData({ tipo, productoId, fechaDesde: v, fechaHasta, page: 1 })
  }
  function handleFechaHasta(v: string) {
    setFechaHasta(v)
    fetchData({ tipo, productoId, fechaDesde, fechaHasta: v, page: 1 })
  }
  function handleLimpiar() {
    setTipo('')
    setProductoId('')
    setFechaDesde('')
    setFechaHasta('')
    fetchData({ tipo: '', productoId: '', fechaDesde: '', fechaHasta: '', page: 1 })
  }
  function handlePage(newPage: number) {
    fetchData({ tipo, productoId, fechaDesde, fechaHasta, page: newPage })
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE)
  const { stats } = data
  const hasFilters = !!(tipo || productoId || fechaDesde || fechaHasta)

  return (
    <div className={isPending ? 'opacity-60 pointer-events-none' : ''}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link href="/productos" className="text-blue-600 hover:underline">← Productos</Link>
        <span className="text-[#94a3b8]">/</span>
        <span className="text-[#64748b]">Movimientos de stock</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[#64748b] tracking-wider">Compras</div>
          <div className="text-xl font-bold text-green-700 mt-1">+{stats.compras.total}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{stats.compras.count} movimientos</div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[#64748b] tracking-wider">Ventas</div>
          <div className="text-xl font-bold text-blue-700 mt-1">-{stats.ventas.total}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{stats.ventas.count} movimientos</div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[#64748b] tracking-wider">Ajustes</div>
          <div className="text-xl font-bold text-amber-700 mt-1">±{stats.ajustes.total}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{stats.ajustes.count} movimientos</div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[#64748b] tracking-wider">Mermas</div>
          <div className="text-xl font-bold text-red-600 mt-1">-{stats.mermas.total}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{stats.mermas.count} movimientos</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 flex gap-3 flex-wrap items-center mb-4">
        <select
          value={tipo}
          onChange={e => handleTipo(e.target.value)}
          className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-white"
        >
          <option value="">Todos los tipos</option>
          <option value="compra">Compra</option>
          <option value="venta">Venta</option>
          <option value="ajuste">Ajuste</option>
          <option value="merma">Merma</option>
        </select>
        <select
          value={productoId}
          onChange={e => handleProducto(e.target.value)}
          className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-white min-w-[160px]"
        >
          <option value="">Todos los productos</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={fechaDesde}
          onChange={e => handleFechaDesde(e.target.value)}
          className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
        />
        <span className="text-[#94a3b8] text-sm">—</span>
        <input
          type="date"
          value={fechaHasta}
          onChange={e => handleFechaHasta(e.target.value)}
          className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
        />
        {hasFilters && (
          <button
            onClick={handleLimpiar}
            className="ml-auto px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-[#e2e8f0]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">Cantidad</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">P. Coste</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Notas</th>
            </tr>
          </thead>
          <tbody>
            {data.movements.map(m => {
              const cfg = TYPE_CONFIG[m.type]
              return (
                <tr key={m.id} className="border-b border-[#f1f5f9] hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-[#64748b] whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[#0f172a]">{m.product_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${cfg.amountColor}`}>
                    {cfg.sign}{m.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-[#64748b]">
                    {m.cost_price !== null ? `${m.cost_price.toFixed(2)} €/u` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8] max-w-[200px] truncate">
                    {m.notes ?? '—'}
                  </td>
                </tr>
              )
            })}
            {data.movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#94a3b8]">
                  Sin movimientos para los filtros aplicados
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data.total > 0 && (
          <div className="px-4 py-3 border-t border-[#e2e8f0] flex items-center justify-between">
            <span className="text-xs text-[#64748b]">
              {data.total} movimientos · página {page} de {totalPages || 1}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                onClick={() => handlePage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

Start the dev server (`npm run dev`) and open `http://localhost:3000/productos/movimientos`. Verify:
- Page loads without errors
- 4 summary cards show totals (they may all be 0 or show real data depending on existing movements)
- Table renders with columns: Fecha, Producto, Tipo badge, Cantidad con signo y color, P. Coste, Notas
- Changing the "Tipos" selector updates the table and cards
- Changing the product selector updates the table and cards
- Setting a date range filters correctly
- "Limpiar" appears when any filter is active and resets all filters
- Pagination buttons appear when total > 50, and navigate correctly

- [ ] **Step 4: Commit**

```bash
git add app/productos/movimientos/MovimientosClient.tsx
git commit -m "feat: add MovimientosClient with filters, stats cards, table and pagination"
```

---

### Task 4: "Movimientos" button in `ProductsClient`

**Files:**
- Modify: `app/productos/ProductsClient.tsx`

- [ ] **Step 1: Add `Link` import**

At the top of `app/productos/ProductsClient.tsx`, add:

```typescript
import Link from 'next/link'
```

- [ ] **Step 2: Add the button in the filter bar**

In the filter bar `<div>` (the one with `className="flex items-center gap-3 mb-4 flex-wrap"`), add the link **before** the existing "Categorías" button:

```typescript
<Link
  href="/productos/movimientos"
  className="px-4 py-2 text-sm border border-[#e2e8f0] bg-white rounded-lg text-[#64748b] hover:bg-slate-50 font-medium"
>
  Movimientos
</Link>
```

The filter bar should now read: `[search] [Stock bajo] [Actualizar] [Movimientos] [Categorías] ... [Añadir producto]`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000/productos`. Confirm "Movimientos" link appears in the toolbar. Click it — should navigate to `/productos/movimientos`.

- [ ] **Step 5: Commit**

```bash
git add app/productos/ProductsClient.tsx
git commit -m "feat: add 'Movimientos' link in ProductsClient toolbar"
```
