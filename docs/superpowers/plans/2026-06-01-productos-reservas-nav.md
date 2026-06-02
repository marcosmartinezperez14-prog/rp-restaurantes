# Productos, Reservas y Navegación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar el bug de order_number, añadir sección de Productos/Inventario, sección de Reservas, y navegación coherente entre todas las secciones.

**Architecture:** Server Components cargan datos iniciales y los pasan a Client Components. Todas las mutaciones van a través de Server Actions. Se añade un componente de nav compartido (`components/AppShell.tsx`) usado por Dashboard, Productos y Reservas; el TPV conserva su propio nav especializado.

**Tech Stack:** Next.js 16.2.6 · React 19 · TypeScript 5 strict · Tailwind v4 · @supabase/ssr v0.10.3

> **Verificación por tarea:** `npx tsc --noEmit`. Verificación final: `npm run build`.

---

## File Map

| Fichero | Estado | Responsabilidad |
|---------|--------|----------------|
| `app/actions/tpv.ts` | Modificar | Fix createOrder: añadir order_number via RPC |
| `components/AppShell.tsx` | Crear | CC: nav lateral compartido (Dashboard, Productos, Reservas) |
| `app/dashboard/page.tsx` | Modificar | Usar AppShell en lugar del layout manual |
| `app/actions/productos.ts` | Crear | Server Actions de productos e inventario |
| `app/productos/page.tsx` | Crear | SC: lista de productos con categorías |
| `components/productos/ProductRow.tsx` | Crear | CC: fila de producto con acciones inline |
| `components/productos/EditProductModal.tsx` | Crear | CC: modal de edición de producto |
| `components/productos/PurchaseModal.tsx` | Crear | CC: modal de registrar compra |
| `components/productos/StockModal.tsx` | Crear | CC: modal de ajuste/merma de stock |
| `components/productos/StockHistory.tsx` | Crear | CC: historial de movimientos de un producto |
| `app/actions/reservas.ts` | Crear | Server Actions de reservas |
| `app/reservas/page.tsx` | Crear | SC: vista de reservas del día |
| `components/reservas/ReservationsList.tsx` | Crear | CC: lista de reservas con acciones |
| `components/reservas/NewReservationModal.tsx` | Crear | CC: modal para crear reserva |

---

## Task 1: Fix bug — order_number en createOrder

**Files:**
- Modify: `app/actions/tpv.ts` (función `createOrder`, líneas ~186-224)

- [ ] **Step 1: Modificar `createOrder` para llamar al RPC antes del insert**

En `app/actions/tpv.ts`, reemplaza la función `createOrder` completa:

```typescript
export async function createOrder(tableId: string): Promise<{ orderId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data: tableCheck } = await supabase
    .from('tables')
    .select('id')
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!tableCheck) return { error: 'Mesa no encontrada' }

  const { data: orderNumber, error: rpcError } = await supabase
    .rpc('get_next_order_number', { p_restaurant_id: restaurantId })

  if (rpcError || orderNumber === null) {
    return { error: `No se pudo obtener el número de comanda: ${rpcError?.message ?? 'sin respuesta'}` }
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      status: 'open',
      type: 'dine_in',
      order_number: orderNumber,
      opened_by: user.id,
      opened_at: new Date().toISOString(),
      order_date: today,
    })
    .select('id')
    .single()

  if (error || !order) return { error: error?.message ?? 'No se pudo crear la comanda' }

  await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId)

  return { orderId: order.id }
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Verificar que los totales ya se muestran (no requiere cambio)**

`getZonesWithTables` ya selecciona `total` y `opened_at` de `orders`, y `TableCard` ya los muestra cuando `status === 'occupied' || 'billing'`. No hay nada que cambiar.

- [ ] **Step 4: Commit**

```powershell
git add app/actions/tpv.ts
git commit -m "fix: add order_number via RPC in createOrder"
```

---

## Task 2: Componente de navegación compartido

**Files:**
- Create: `components/AppShell.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Crear `components/AppShell.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Inicio',    icon: '🏠' },
  { href: '/tpv',        label: 'TPV',        icon: '🖥️' },
  { href: '/reservas',   label: 'Reservas',   icon: '📅' },
  { href: '/productos',  label: 'Productos',  icon: '📦' },
]

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-[#e2e8f0] flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <span className="text-[13px] font-bold text-[#64748b] uppercase tracking-widest">RP Restaurantes</span>
        </div>
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href) && item.href !== '/dashboard'
              ? true
              : pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-[#64748b] hover:bg-slate-100 hover:text-[#0f172a]'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-3 py-3 border-t border-[#e2e8f0]">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              🚪 Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-[#e2e8f0] px-6 h-[52px] flex items-center flex-shrink-0 shadow-sm">
          <h1 className="text-[15px] font-semibold text-[#0f172a]">{title}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Actualizar `app/dashboard/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import RepairButton from './RepairButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AppShell title="Panel de control">
      <div className="max-w-sm">
        <p className="text-sm text-[#64748b] mb-4">
          Bienvenido, <span className="font-medium text-[#0f172a]">{user.email}</span>
        </p>
        <RepairButton />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add components/AppShell.tsx app/dashboard/page.tsx
git commit -m "feat: add shared AppShell navigation sidebar"
```

---

## Task 3: Server Actions de productos

**Files:**
- Create: `app/actions/productos.ts`

- [ ] **Step 1: Crear `app/actions/productos.ts`**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProductoConCategoria = {
  id: string
  name: string
  price: number
  cost_price: number | null
  tax_rate: number
  is_available: boolean
  is_visible: boolean
  track_stock: boolean
  stock: number | null
  stock_min: number | null
  supplier: string | null
  last_purchase_date: string | null
  category_id: string
  category_name: string
}

export type StockMovement = {
  id: string
  product_id: string
  type: 'compra' | 'venta' | 'ajuste' | 'merma'
  quantity: number
  cost_price: number | null
  purchase_date: string | null
  notes: string | null
  created_at: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getRestaurantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('id', userId)
    .single()
  return data?.restaurant_id ?? null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getProductos(): Promise<ProductoConCategoria[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('products')
    .select('id, name, price, cost_price, tax_rate, is_available, is_visible, track_stock, stock, stock_min, supplier, last_purchase_date, category_id, categories(name)')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('name')

  return (data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    cost_price: p.cost_price !== null ? Number(p.cost_price) : null,
    tax_rate: Number(p.tax_rate),
    is_available: p.is_available,
    is_visible: p.is_visible,
    track_stock: p.track_stock ?? false,
    stock: p.stock !== null ? Number(p.stock) : null,
    stock_min: p.stock_min !== null ? Number(p.stock_min) : null,
    supplier: p.supplier ?? null,
    last_purchase_date: p.last_purchase_date ?? null,
    category_id: p.category_id,
    category_name: (p.categories as { name: string } | null)?.name ?? '—',
  }))
}

export async function updateProducto(
  productId: string,
  data: {
    price?: number
    cost_price?: number | null
    stock_min?: number | null
    supplier?: string | null
    track_stock?: boolean
    is_available?: boolean
    is_visible?: boolean
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { error } = await supabase
    .from('products')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}

export async function registrarCompra(params: {
  productId: string
  quantity: number
  costPrice: number
  purchaseDate: string
  notes?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (params.quantity <= 0) return { error: 'La cantidad debe ser mayor que 0' }
  if (params.costPrice < 0) return { error: 'El precio no puede ser negativo' }

  const { error: movErr } = await supabase.from('stock_movements').insert({
    restaurant_id: restaurantId,
    product_id: params.productId,
    type: 'compra',
    quantity: params.quantity,
    cost_price: params.costPrice,
    purchase_date: params.purchaseDate,
    notes: params.notes ?? null,
    created_by: user.id,
  })

  if (movErr) return { error: movErr.message }

  const { data: current } = await supabase
    .from('products')
    .select('stock')
    .eq('id', params.productId)
    .single()

  const newStock = (Number(current?.stock) || 0) + params.quantity

  const { error: updErr } = await supabase
    .from('products')
    .update({
      stock: newStock,
      cost_price: params.costPrice,
      last_purchase_date: params.purchaseDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.productId)
    .eq('restaurant_id', restaurantId)

  if (updErr) return { error: updErr.message }
  return {}
}

export async function ajustarStock(params: {
  productId: string
  type: 'ajuste' | 'merma'
  quantity: number
  notes?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data: current } = await supabase
    .from('products')
    .select('stock')
    .eq('id', params.productId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!current) return { error: 'Producto no encontrado' }

  const delta = params.type === 'merma' ? -Math.abs(params.quantity) : params.quantity
  const newStock = (Number(current.stock) || 0) + delta

  const { error: movErr } = await supabase.from('stock_movements').insert({
    restaurant_id: restaurantId,
    product_id: params.productId,
    type: params.type,
    quantity: params.quantity,
    cost_price: null,
    purchase_date: null,
    notes: params.notes ?? null,
    created_by: user.id,
  })

  if (movErr) return { error: movErr.message }

  const { error: updErr } = await supabase
    .from('products')
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq('id', params.productId)
    .eq('restaurant_id', restaurantId)

  if (updErr) return { error: updErr.message }
  return {}
}

export async function getStockMovements(productId: string): Promise<StockMovement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('stock_movements')
    .select('id, product_id, type, quantity, cost_price, purchase_date, notes, created_at')
    .eq('product_id', productId)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []).map(m => ({
    id: m.id,
    product_id: m.product_id,
    type: m.type as StockMovement['type'],
    quantity: Number(m.quantity),
    cost_price: m.cost_price !== null ? Number(m.cost_price) : null,
    purchase_date: m.purchase_date ?? null,
    notes: m.notes ?? null,
    created_at: m.created_at,
  }))
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add app/actions/productos.ts
git commit -m "feat: add productos server actions (CRUD, stock movements)"
```

---

## Task 4: UI de Productos — modales y fila de producto

**Files:**
- Create: `components/productos/EditProductModal.tsx`
- Create: `components/productos/PurchaseModal.tsx`
- Create: `components/productos/StockModal.tsx`
- Create: `components/productos/StockHistory.tsx`
- Create: `components/productos/ProductRow.tsx`

- [ ] **Step 1: Crear `components/productos/EditProductModal.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria } from '@/app/actions/productos'
import { updateProducto } from '@/app/actions/productos'

interface Props {
  product: ProductoConCategoria
  onClose: () => void
  onSaved: () => void
}

export default function EditProductModal({ product, onClose, onSaved }: Props) {
  const [price, setPrice] = useState(product.price.toFixed(2))
  const [costPrice, setCostPrice] = useState(product.cost_price?.toFixed(2) ?? '')
  const [stockMin, setStockMin] = useState(product.stock_min?.toString() ?? '')
  const [supplier, setSupplier] = useState(product.supplier ?? '')
  const [trackStock, setTrackStock] = useState(product.track_stock)
  const [isAvailable, setIsAvailable] = useState(product.is_available)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const priceNum = parseFloat(price.replace(',', '.'))
    const costNum = costPrice ? parseFloat(costPrice.replace(',', '.')) : null
    const minNum = stockMin ? parseInt(stockMin) : null
    if (isNaN(priceNum) || priceNum < 0) { setError('Precio de venta inválido'); return }

    setError(null)
    startTransition(async () => {
      const res = await updateProducto(product.id, {
        price: priceNum,
        cost_price: costNum,
        stock_min: minNum,
        supplier: supplier.trim() || null,
        track_stock: trackStock,
        is_available: isAvailable,
      })
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-bold text-[#0f172a]">{product.name}</h2>
          <p className="text-xs text-[#64748b]">{product.category_name}</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Precio venta (€)</span>
              <input value={price} onChange={e => setPrice(e.target.value)}
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Precio coste (€)</span>
              <input value={costPrice} onChange={e => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Proveedor</span>
            <input value={supplier} onChange={e => setSupplier(e.target.value)}
              placeholder="Nombre del proveedor"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Stock mínimo</span>
            <input value={stockMin} onChange={e => setStockMin(e.target.value)}
              type="number" min="0" placeholder="0"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trackStock} onChange={e => setTrackStock(e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-[#0f172a]">Control de stock</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-[#0f172a]">Disponible</span>
            </label>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `components/productos/PurchaseModal.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria } from '@/app/actions/productos'
import { registrarCompra } from '@/app/actions/productos'

interface Props {
  product: ProductoConCategoria
  onClose: () => void
  onSaved: () => void
}

export default function PurchaseModal({ product, onClose, onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [quantity, setQuantity] = useState('')
  const [costPrice, setCostPrice] = useState(product.cost_price?.toFixed(2) ?? '')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const qty = parseFloat(quantity.replace(',', '.'))
    const cost = parseFloat(costPrice.replace(',', '.'))
    if (isNaN(qty) || qty <= 0) { setError('Cantidad inválida'); return }
    if (isNaN(cost) || cost < 0) { setError('Precio inválido'); return }
    if (!date) { setError('Introduce una fecha'); return }

    setError(null)
    startTransition(async () => {
      const res = await registrarCompra({
        productId: product.id,
        quantity: qty,
        costPrice: cost,
        purchaseDate: date,
        notes: notes.trim() || undefined,
      })
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-bold text-[#0f172a]">Registrar compra</h2>
          <p className="text-xs text-[#64748b]">{product.name}</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Cantidad</span>
            <input value={quantity} onChange={e => setQuantity(e.target.value)}
              type="number" min="0.01" step="0.01" placeholder="0"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Precio coste unitario (€)</span>
            <input value={costPrice} onChange={e => setCostPrice(e.target.value)}
              type="number" min="0" step="0.01" placeholder="0.00"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Fecha</span>
            <input value={date} onChange={e => setDate(e.target.value)}
              type="date"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Notas (opcional)</span>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Proveedor habitual"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-green-700 text-white font-semibold rounded-lg hover:bg-green-800 disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Registrar compra'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear `components/productos/StockModal.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria } from '@/app/actions/productos'
import { ajustarStock } from '@/app/actions/productos'

interface Props {
  product: ProductoConCategoria
  mode: 'ajuste' | 'merma'
  onClose: () => void
  onSaved: () => void
}

export default function StockModal({ product, mode, onClose, onSaved }: Props) {
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const title = mode === 'merma' ? 'Registrar merma' : 'Ajustar stock'
  const btnColor = mode === 'merma' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'

  function handleSave() {
    const qty = parseFloat(quantity.replace(',', '.'))
    if (isNaN(qty) || qty <= 0) { setError('Introduce una cantidad válida'); return }

    setError(null)
    startTransition(async () => {
      const res = await ajustarStock({
        productId: product.id,
        type: mode,
        quantity: qty,
        notes: notes.trim() || undefined,
      })
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-bold text-[#0f172a]">{title}</h2>
          <p className="text-xs text-[#64748b]">{product.name} · Stock actual: {product.stock ?? 0}</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">
              {mode === 'merma' ? 'Unidades perdidas' : 'Nuevo stock (ajuste a este valor)'}
            </span>
            <input value={quantity} onChange={e => setQuantity(e.target.value)}
              type="number" min="0.01" step="0.01" placeholder="0"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          {mode === 'ajuste' && (
            <p className="text-xs text-[#64748b]">
              Stock resultante: {((Number(product.stock) || 0) + (parseFloat(quantity) || 0)).toFixed(2)}
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Motivo (opcional)</span>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Rotura, caducidad..."
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className={`px-4 py-2 text-sm text-white font-semibold rounded-lg disabled:opacity-50 ${btnColor}`}>
            {isPending ? 'Guardando...' : title}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Crear `components/productos/StockHistory.tsx`**

```tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import type { StockMovement } from '@/app/actions/productos'
import { getStockMovements } from '@/app/actions/productos'

const TYPE_CONFIG = {
  compra:  { label: 'Compra',  color: 'text-green-700 bg-green-50' },
  venta:   { label: 'Venta',   color: 'text-blue-700 bg-blue-50' },
  ajuste:  { label: 'Ajuste',  color: 'text-amber-700 bg-amber-50' },
  merma:   { label: 'Merma',   color: 'text-red-700 bg-red-50' },
}

export default function StockHistory({ productId }: { productId: string }) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const data = await getStockMovements(productId)
      setMovements(data)
    })
  }, [productId])

  if (isPending) return <p className="text-xs text-[#94a3b8] py-2">Cargando historial...</p>
  if (movements.length === 0) return <p className="text-xs text-[#94a3b8] py-2">Sin movimientos</p>

  return (
    <div className="flex flex-col gap-1 mt-2">
      {movements.map(m => {
        const cfg = TYPE_CONFIG[m.type]
        const sign = m.type === 'merma' ? '-' : m.type === 'venta' ? '-' : '+'
        return (
          <div key={m.id} className="flex items-center gap-2 text-xs py-1 border-b border-[#f1f5f9] last:border-0">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
            <span className="font-semibold text-[#0f172a]">{sign}{m.quantity}</span>
            {m.cost_price !== null && <span className="text-[#64748b]">{Number(m.cost_price).toFixed(2)} €/u</span>}
            {m.purchase_date && <span className="text-[#94a3b8]">{m.purchase_date}</span>}
            {m.notes && <span className="text-[#94a3b8] truncate">{m.notes}</span>}
            <span className="ml-auto text-[#94a3b8] flex-shrink-0">
              {new Date(m.created_at).toLocaleDateString('es-ES')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Crear `components/productos/ProductRow.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { ProductoConCategoria } from '@/app/actions/productos'
import EditProductModal from './EditProductModal'
import PurchaseModal from './PurchaseModal'
import StockModal from './StockModal'
import StockHistory from './StockHistory'

interface Props {
  product: ProductoConCategoria
  onRefresh: () => void
}

export default function ProductRow({ product, onRefresh }: Props) {
  const [modal, setModal] = useState<'edit' | 'purchase' | 'ajuste' | 'merma' | 'history' | null>(null)

  const margin = product.cost_price !== null
    ? product.price - product.cost_price
    : null
  const marginPct = margin !== null && product.cost_price && product.cost_price > 0
    ? (margin / product.cost_price) * 100
    : null

  const stockLow = product.track_stock && product.stock !== null && product.stock_min !== null
    && product.stock <= product.stock_min
  const stockCritical = product.track_stock && product.stock !== null
    && product.stock_min !== null && product.stock <= product.stock_min * 0.5

  return (
    <>
      <tr className={`border-b border-[#f1f5f9] hover:bg-slate-50 ${!product.is_visible ? 'opacity-50' : ''}`}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {stockCritical && <span title="Stock crítico" className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
            {!stockCritical && stockLow && <span title="Stock bajo" className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
            <span className="text-sm font-medium text-[#0f172a]">{product.name}</span>
            {!product.is_available && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase font-semibold">No disp.</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-[#64748b]">{product.category_name}</td>
        <td className="px-4 py-3 text-sm text-right font-semibold text-[#0f172a]">{product.price.toFixed(2)} €</td>
        <td className="px-4 py-3 text-sm text-right text-[#64748b]">
          {product.cost_price !== null ? `${product.cost_price.toFixed(2)} €` : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right">
          {margin !== null ? (
            <span className={margin >= 0 ? 'text-green-700' : 'text-red-600'}>
              {margin.toFixed(2)} €{marginPct !== null ? ` (${marginPct.toFixed(0)}%)` : ''}
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right">
          {product.track_stock ? (
            <span className={stockCritical ? 'text-red-600 font-bold' : stockLow ? 'text-amber-600 font-semibold' : 'text-[#0f172a]'}>
              {product.stock ?? 0}
              {product.stock_min !== null && <span className="text-[#94a3b8] text-xs"> / mín {product.stock_min}</span>}
            </span>
          ) : <span className="text-[#94a3b8] text-xs">Sin control</span>}
        </td>
        <td className="px-4 py-3 text-xs text-[#64748b]">{product.supplier ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1 justify-end flex-wrap">
            <button onClick={() => setModal('edit')}
              className="px-2 py-1 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-100">
              Editar
            </button>
            <button onClick={() => setModal('purchase')}
              className="px-2 py-1 text-xs bg-green-50 border border-green-200 rounded-lg text-green-700 hover:bg-green-100">
              Compra
            </button>
            <button onClick={() => setModal('ajuste')}
              className="px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded-lg text-amber-700 hover:bg-amber-100">
              Ajuste
            </button>
            <button onClick={() => setModal('merma')}
              className="px-2 py-1 text-xs bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100">
              Merma
            </button>
            <button onClick={() => setModal(modal === 'history' ? null : 'history')}
              className="px-2 py-1 text-xs bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200">
              Historial
            </button>
          </div>
        </td>
      </tr>
      {modal === 'history' && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-8 pb-3 pt-1">
            <StockHistory productId={product.id} />
          </td>
        </tr>
      )}
      {modal === 'edit' && (
        <EditProductModal product={product} onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === 'purchase' && (
        <PurchaseModal product={product} onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === 'ajuste' && (
        <StockModal product={product} mode="ajuste" onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === 'merma' && (
        <StockModal product={product} mode="merma" onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
    </>
  )
}
```

- [ ] **Step 6: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```powershell
git add components/productos/
git commit -m "feat: add productos UI components (edit, purchase, stock modals, history)"
```

---

## Task 5: Página de Productos

**Files:**
- Create: `app/productos/page.tsx`

- [ ] **Step 1: Crear `app/productos/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import ProductsClient from './ProductsClient'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const products = await getProductos()

  return (
    <AppShell title="Productos e Inventario">
      <ProductsClient initialProducts={products} />
    </AppShell>
  )
}
```

- [ ] **Step 2: Crear `app/productos/ProductsClient.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria } from '@/app/actions/productos'
import { getProductos } from '@/app/actions/productos'
import ProductRow from '@/components/productos/ProductRow'

export default function ProductsClient({ initialProducts }: { initialProducts: ProductoConCategoria[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getProductos()
      setProducts(fresh)
    })
  }

  const visible = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      || p.category_name.toLowerCase().includes(search.toLowerCase())
    const matchLow = !filterLow || (p.track_stock && p.stock !== null && p.stock_min !== null && p.stock <= p.stock_min)
    return matchSearch && matchLow
  })

  const lowStockCount = products.filter(p =>
    p.track_stock && p.stock !== null && p.stock_min !== null && p.stock <= p.stock_min
  ).length

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto o categoría..."
          className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 w-64"
        />
        {lowStockCount > 0 && (
          <button
            onClick={() => setFilterLow(f => !f)}
            className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
              filterLow
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            ⚠️ Stock bajo ({lowStockCount})
          </button>
        )}
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="px-3 py-2 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 disabled:opacity-50 ml-auto"
        >
          {isPending ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Categoría</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">P. Venta</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">P. Coste</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">Margen</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">Stock</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Proveedor</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(product => (
              <ProductRow key={product.id} product={product} onRefresh={handleRefresh} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#94a3b8]">
                  {search || filterLow ? 'Sin resultados para el filtro aplicado' : 'Sin productos'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add app/productos/
git commit -m "feat: add productos/inventario page with stock management"
```

---

## Task 6: Server Actions de Reservas

**Files:**
- Create: `app/actions/reservas.ts`

- [ ] **Step 1: Crear `app/actions/reservas.ts`**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReservationStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'

export type Reservation = {
  id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  party_size: number
  reservation_date: string
  reservation_time: string
  status: ReservationStatus
  notes: string | null
  table_id: string | null
  table_name: string | null
  created_at: string
}

export type TableOption = {
  id: string
  name: string
  capacity: number
  zone_name: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getRestaurantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('id', userId)
    .single()
  return data?.restaurant_id ?? null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getReservationsByDate(date: string): Promise<Reservation[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('reservations')
    .select('id, customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, status, notes, table_id, created_at, tables(name)')
    .eq('restaurant_id', restaurantId)
    .eq('reservation_date', date)
    .is('deleted_at', null)
    .order('reservation_time')

  return (data ?? []).map(r => ({
    id: r.id,
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    customer_email: r.customer_email ?? null,
    party_size: r.party_size,
    reservation_date: r.reservation_date,
    reservation_time: r.reservation_time,
    status: r.status as ReservationStatus,
    notes: r.notes ?? null,
    table_id: r.table_id ?? null,
    table_name: (r.tables as { name: string } | null)?.name ?? null,
    created_at: r.created_at,
  }))
}

export async function createReservation(params: {
  customerName: string
  customerPhone: string
  customerEmail?: string
  partySize: number
  date: string
  time: string
  tableId?: string
  notes?: string
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!params.customerName.trim()) return { error: 'El nombre es obligatorio' }
  if (!params.customerPhone.trim()) return { error: 'El teléfono es obligatorio' }
  if (params.partySize < 1) return { error: 'El número de comensales debe ser al menos 1' }

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      restaurant_id: restaurantId,
      customer_name: params.customerName.trim(),
      customer_phone: params.customerPhone.trim(),
      customer_email: params.customerEmail?.trim() || null,
      party_size: params.partySize,
      reservation_date: params.date,
      reservation_time: params.time,
      status: 'confirmed',
      table_id: params.tableId || null,
      notes: params.notes?.trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'No se pudo crear la reserva' }
  return { id: data.id }
}

export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { error } = await supabase
    .from('reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}

export async function deleteReservation(reservationId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { error } = await supabase
    .from('reservations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reservationId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}

export async function getTableOptions(): Promise<TableOption[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('tables')
    .select('id, name, capacity, zones(name)')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('position')

  return (data ?? []).map(t => ({
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    zone_name: (t.zones as { name: string } | null)?.name ?? '',
  }))
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add app/actions/reservas.ts
git commit -m "feat: add reservas server actions (CRUD, status management)"
```

---

## Task 7: UI de Reservas

**Files:**
- Create: `components/reservas/NewReservationModal.tsx`
- Create: `components/reservas/ReservationsList.tsx`
- Create: `app/reservas/page.tsx`

- [ ] **Step 1: Crear `components/reservas/NewReservationModal.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { TableOption } from '@/app/actions/reservas'
import { createReservation } from '@/app/actions/reservas'

interface Props {
  tables: TableOption[]
  defaultDate: string
  onClose: () => void
  onSaved: () => void
}

export default function NewReservationModal({ tables, defaultDate, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('13:00')
  const [tableId, setTableId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const size = parseInt(partySize)
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (!phone.trim()) { setError('El teléfono es obligatorio'); return }
    if (isNaN(size) || size < 1) { setError('Número de comensales inválido'); return }

    setError(null)
    startTransition(async () => {
      const res = await createReservation({
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
        partySize: size,
        date,
        time,
        tableId: tableId || undefined,
        notes: notes || undefined,
      })
      if ('error' in res) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex-shrink-0">
          <h2 className="font-bold text-[#0f172a]">Nueva reserva</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs font-medium text-[#64748b]">Nombre *</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Teléfono *</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="600 000 000" type="tel"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Email</span>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" type="email"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Comensales *</span>
              <input value={partySize} onChange={e => setPartySize(e.target.value)} type="number" min="1"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Mesa</span>
              <select value={tableId} onChange={e => setTableId(e.target.value)}
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white">
                <option value="">Sin asignar</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.zone_name}, {t.capacity} pers.)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Fecha *</span>
              <input value={date} onChange={e => setDate(e.target.value)} type="date"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Hora *</span>
              <input value={time} onChange={e => setTime(e.target.value)} type="time"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Notas</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Alergias, preferencias de mesa..."
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
          </label>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `components/reservas/ReservationsList.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { Reservation, ReservationStatus, TableOption } from '@/app/actions/reservas'
import { getReservationsByDate, updateReservationStatus, deleteReservation } from '@/app/actions/reservas'
import NewReservationModal from './NewReservationModal'

const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string }> = {
  confirmed: { label: 'Confirmada',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  seated:    { label: 'Sentada',       color: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Completada',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelada',     color: 'bg-red-50 text-red-600 border-red-200' },
  no_show:   { label: 'No presentado', color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const NEXT_STATUSES: Record<ReservationStatus, ReservationStatus[]> = {
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated:    ['completed', 'cancelled'],
  completed: [],
  cancelled: ['confirmed'],
  no_show:   ['confirmed'],
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: 'Confirmada',
  seated:    'Sentar',
  completed: 'Completar',
  cancelled: 'Cancelar',
  no_show:   'No presentado',
}

interface Props {
  initialReservations: Reservation[]
  tables: TableOption[]
  initialDate: string
}

export default function ReservationsList({ initialReservations, tables, initialDate }: Props) {
  const [reservations, setReservations] = useState(initialReservations)
  const [date, setDate] = useState(initialDate)
  const [showNew, setShowNew] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function loadDate(d: string) {
    setDate(d)
    startTransition(async () => {
      const data = await getReservationsByDate(d)
      setReservations(data)
    })
  }

  function handleStatusChange(id: string, status: ReservationStatus) {
    setError(null)
    startTransition(async () => {
      const res = await updateReservationStatus(id, status)
      if (res.error) { setError(res.error); return }
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta reserva?')) return
    startTransition(async () => {
      const res = await deleteReservation(id)
      if (res.error) { setError(res.error); return }
      setReservations(prev => prev.filter(r => r.id !== id))
    })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={e => loadDate(e.target.value)}
          className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        {date !== todayStr && (
          <button onClick={() => loadDate(todayStr)}
            className="px-3 py-2 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200">
            Hoy
          </button>
        )}
        <span className="text-sm text-[#64748b]">
          {reservations.length} reserva{reservations.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
        >
          + Nueva reserva
        </button>
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 ml-4 font-bold">✕</button>
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-2">
        {reservations.length === 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-xl px-6 py-10 text-center text-sm text-[#94a3b8]">
            No hay reservas para este día
          </div>
        )}
        {reservations.map(r => {
          const cfg = STATUS_CONFIG[r.status]
          const nextStatuses = NEXT_STATUSES[r.status]
          return (
            <div key={r.id} className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 flex items-start gap-3 flex-wrap">
              {/* Time */}
              <div className="text-[18px] font-black text-[#0f172a] w-14 flex-shrink-0 pt-0.5">
                {r.reservation_time.slice(0, 5)}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#0f172a]">{r.customer_name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[#64748b] flex-wrap">
                  <span>📞 {r.customer_phone}</span>
                  <span>👥 {r.party_size} pers.</span>
                  {r.table_name && <span>🪑 {r.table_name}</span>}
                  {r.customer_email && <span>✉️ {r.customer_email}</span>}
                </div>
                {r.notes && (
                  <p className="text-xs text-[#94a3b8] mt-0.5 italic">{r.notes}</p>
                )}
              </div>
              {/* Actions */}
              <div className="flex gap-1.5 flex-wrap flex-shrink-0">
                {nextStatuses.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(r.id, s)}
                    disabled={isPending}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border disabled:opacity-50 transition-colors ${STATUS_CONFIG[s].color} hover:opacity-80`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
                {r.status !== 'completed' && r.status !== 'seated' && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={isPending}
                    className="px-2.5 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 disabled:opacity-50"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showNew && (
        <NewReservationModal
          tables={tables}
          defaultDate={date}
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            const fresh = await getReservationsByDate(date)
            setReservations(fresh)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Crear `app/reservas/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getReservationsByDate, getTableOptions } from '@/app/actions/reservas'
import AppShell from '@/components/AppShell'
import ReservationsList from '@/components/reservas/ReservationsList'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const [reservations, tables] = await Promise.all([
    getReservationsByDate(today),
    getTableOptions(),
  ])

  return (
    <AppShell title="Reservas">
      <ReservationsList
        initialReservations={reservations}
        tables={tables}
        initialDate={today}
      />
    </AppShell>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```powershell
git add components/reservas/ app/reservas/
git commit -m "feat: add reservas page with date selector and status management"
```

---

## Task 8: Build final y verificación

- [ ] **Step 1: Build de producción**

```powershell
npm run build
```

Resultado esperado:
```
✓ Compiled successfully
Route (app)
├ ƒ /dashboard
├ ƒ /productos
├ ƒ /reservas
├ ƒ /tpv
...
```

- [ ] **Step 2: Commit final**

```powershell
git add -A
git commit -m "feat: complete productos, reservas, navigation — full feature set"
```

---

## Self-Review

### Spec coverage

| Requisito | Tarea |
|-----------|-------|
| Fix bug order_number | Task 1 |
| Totales en mapa (ya funciona) | Task 1 (verificación) |
| Listado productos con columnas especificadas | Task 4+5 |
| Editar precio venta, coste, stock_min, proveedor, track_stock | Task 4 (EditProductModal) |
| Registrar compra → stock_movements + stock + cost_price | Task 3+4 (PurchaseModal) |
| Ajuste/merma → stock_movements + stock | Task 3+4 (StockModal) |
| Indicador visual stock bajo | Task 4 (ProductRow, punto rojo/amarillo) |
| Margen (price-cost_price) y porcentaje | Task 4 (ProductRow) |
| Historial movimientos por producto | Task 4 (StockHistory) |
| Reservas del día, selector fecha | Task 7 |
| Listado con hora, nombre, teléfono, comensales, mesa, estado | Task 7 (ReservationsList) |
| Nueva reserva: form completo | Task 7 (NewReservationModal) |
| Cambiar estado reserva | Task 7 (botones de estado) |
| Borrar reserva | Task 7 |
| Integración visual con TPV (solo cambio estado) | Task 6 (updateReservationStatus) |
| Navegación coherente: Dashboard, TPV, Productos, Reservas | Task 2 (AppShell) |
| Server Actions para todo | Tasks 3, 6 |
| Multitenant (restaurant_id en todos los inserts) | Tasks 3, 6 |
| Sin modificar lib/supabase/server.ts ni auth | ✓ no se tocan |
| TypeScript estricto sin any | ✓ todos los tipos definidos |
| Dinero con 2 decimales | ✓ `.toFixed(2)` en todos los componentes |
| Errores en español | ✓ todos los mensajes en español |
