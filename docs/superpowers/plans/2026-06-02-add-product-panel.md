# Add Product Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un botón "+ Añadir producto" en la página de Productos que abre un panel lateral (slide-over) con un formulario completo para crear un nuevo producto.

**Architecture:** Server Component carga categorías y productos en paralelo y los pasa a `ProductsClient`. El panel lateral `AddProductPanel` recibe las categorías como prop, valida en cliente y llama a `createProduct` server action. Al guardar, reutiliza el `handleRefresh` existente para recargar la lista sin recargar la página.

**Tech Stack:** Next.js 16.2.6 · React 19 · TypeScript 5 strict · Tailwind v4 · @supabase/ssr v0.10.3

> **Verificación por tarea:** `npx tsc --noEmit`. Verificación final: `npm run build`.

---

## File Map

| Fichero | Estado | Responsabilidad |
|---------|--------|----------------|
| `app/actions/productos.ts` | Modificar | Añadir tipo `Categoria`, `getCategorias`, `createProduct` |
| `app/productos/page.tsx` | Modificar | Cargar categorías en paralelo, pasar a `ProductsClient` |
| `app/productos/ProductsClient.tsx` | Modificar | Añadir prop `categories`, botón y render del panel |
| `components/productos/AddProductPanel.tsx` | Crear | Slide-over con formulario de creación |

---

## Task 1: Server actions — `getCategorias` y `createProduct`

**Files:**
- Modify: `app/actions/productos.ts`

- [ ] **Step 1: Añadir el tipo `Categoria` después de `StockMovement`**

En `app/actions/productos.ts`, añade esto inmediatamente después del bloque que cierra `StockMovement` (después de la línea `}`  que cierra ese tipo, antes del comentario `// ─── Helper`):

```typescript
export type Categoria = {
  id: string
  name: string
  position: number
}
```

- [ ] **Step 2: Añadir `getCategorias` al final del fichero**

Añade esta función al final de `app/actions/productos.ts`:

```typescript
export async function getCategorias(): Promise<Categoria[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurantId)
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  return (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    position: c.position ?? 0,
  }))
}
```

- [ ] **Step 3: Añadir `createProduct` al final del fichero**

Añade esta función al final de `app/actions/productos.ts`:

```typescript
export async function createProduct(params: {
  name: string
  categoryId: string
  description?: string
  price: number
  costPrice?: number
  taxRate: number
  stock: number
  stockMin: number
  trackStock: boolean
  supplier?: string
  sku?: string
  isAvailable: boolean
  isVisible: boolean
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!params.name.trim()) return { error: 'El nombre es obligatorio' }
  if (!params.categoryId) return { error: 'Selecciona una categoría' }
  if (params.price <= 0) return { error: 'El precio de venta debe ser mayor que 0' }
  if (params.costPrice !== undefined && params.costPrice <= 0) {
    return { error: 'El precio de compra debe ser mayor que 0' }
  }

  const { data: maxPosRow } = await supabase
    .from('products')
    .select('position')
    .eq('restaurant_id', restaurantId)
    .eq('category_id', params.categoryId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxPosRow?.position ?? -1) + 1

  const { data: product, error: insertErr } = await supabase
    .from('products')
    .insert({
      restaurant_id: restaurantId,
      category_id: params.categoryId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      price: params.price,
      cost_price: params.costPrice ?? null,
      tax_rate: params.taxRate,
      stock: params.stock,
      stock_min: params.stockMin,
      track_stock: params.trackStock,
      supplier: params.supplier?.trim() || null,
      sku: params.sku?.trim() || null,
      is_available: params.isAvailable,
      is_visible: params.isVisible,
      position,
    })
    .select('id')
    .single()

  if (insertErr || !product) {
    return { error: insertErr?.message ?? 'No se pudo crear el producto' }
  }

  if (params.trackStock && params.stock > 0) {
    const { error: movErr } = await supabase.from('stock_movements').insert({
      restaurant_id: restaurantId,
      product_id: product.id,
      type: 'ajuste',
      quantity: params.stock,
      cost_price: null,
      purchase_date: null,
      notes: 'Stock inicial',
      created_by: user.id,
    })
    if (movErr) return { error: `Producto creado pero error al registrar stock: ${movErr.message}` }
  }

  return { success: true }
}
```

- [ ] **Step 4: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 5: Commit**

```powershell
git add app/actions/productos.ts
git commit -m "feat: add getCategorias and createProduct server actions"
```

---

## Task 2: Actualizar `ProductosPage` para cargar categorías

**Files:**
- Modify: `app/productos/page.tsx`

- [ ] **Step 1: Reemplazar el contenido de `app/productos/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos, getCategorias } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import ProductsClient from './ProductsClient'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [products, categories] = await Promise.all([
    getProductos(),
    getCategorias(),
  ])

  return (
    <AppShell title="Productos e Inventario">
      <ProductsClient initialProducts={products} categories={categories} />
    </AppShell>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: error en `ProductsClient` porque aún no acepta `categories` — se resuelve en Task 3.

- [ ] **Step 3: Commit**

```powershell
git add app/productos/page.tsx
git commit -m "feat: load categories in ProductosPage for add-product panel"
```

---

## Task 3: Crear `AddProductPanel`

**Files:**
- Create: `components/productos/AddProductPanel.tsx`

- [ ] **Step 1: Crear `components/productos/AddProductPanel.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { Categoria } from '@/app/actions/productos'
import { createProduct } from '@/app/actions/productos'

const TAX_OPTIONS = [
  { value: 4,  label: '4% — Superreducido' },
  { value: 10, label: '10% — Reducido' },
  { value: 21, label: '21% — General' },
]

interface Props {
  categories: Categoria[]
  onClose: () => void
  onSaved: () => void
}

export default function AddProductPanel({ categories, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [taxRate, setTaxRate] = useState(10)
  const [stock, setStock] = useState('0')
  const [stockMin, setStockMin] = useState('0')
  const [trackStock, setTrackStock] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [sku, setSku] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const priceNum = parseFloat(price.replace(',', '.'))
    const costNum = costPrice.trim() ? parseFloat(costPrice.replace(',', '.')) : undefined
    const stockNum = parseFloat(stock) || 0
    const stockMinNum = parseFloat(stockMin) || 0

    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (!categoryId) { setError('Selecciona una categoría'); return }
    if (isNaN(priceNum) || priceNum <= 0) { setError('El precio de venta debe ser mayor que 0'); return }
    if (costNum !== undefined && (isNaN(costNum) || costNum <= 0)) {
      setError('El precio de compra debe ser mayor que 0')
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await createProduct({
        name,
        categoryId,
        description: description || undefined,
        price: priceNum,
        costPrice: costNum,
        taxRate,
        stock: stockNum,
        stockMin: stockMinNum,
        trackStock,
        supplier: supplier || undefined,
        sku: sku || undefined,
        isAvailable,
        isVisible,
      })
      if ('error' in res) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const inputClass = 'border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 w-full'
  const labelClass = 'flex flex-col gap-1'
  const labelTextClass = 'text-xs font-medium text-[#64748b]'

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
          <h2 className="text-[15px] font-bold text-[#0f172a]">Nuevo producto</h2>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#0f172a] text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Nombre */}
          <label className={labelClass}>
            <span className={labelTextClass}>Nombre *</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Coca-Cola 33cl"
              className={inputClass}
            />
          </label>

          {/* Categoría */}
          <label className={labelClass}>
            <span className={labelTextClass}>Categoría *</span>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className={`${inputClass} bg-white`}
            >
              <option value="">Selecciona una categoría</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {/* Descripción */}
          <label className={labelClass}>
            <span className={labelTextClass}>Descripción</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Descripción opcional del producto..."
              className={`${inputClass} resize-none`}
            />
          </label>

          {/* Precio venta + Precio compra */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Precio venta (€) *</span>
              <input
                value={price}
                onChange={e => setPrice(e.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Precio compra (€)</span>
              <input
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className={inputClass}
              />
            </label>
          </div>

          {/* IVA */}
          <label className={labelClass}>
            <span className={labelTextClass}>IVA aplicable *</span>
            <select
              value={taxRate}
              onChange={e => setTaxRate(Number(e.target.value))}
              className={`${inputClass} bg-white`}
            >
              {TAX_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {/* Stock actual + Stock mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Stock actual</span>
              <input
                value={stock}
                onChange={e => setStock(e.target.value)}
                type="number"
                min="0"
                step="0.001"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Stock mínimo</span>
              <input
                value={stockMin}
                onChange={e => setStockMin(e.target.value)}
                type="number"
                min="0"
                step="0.001"
                className={inputClass}
              />
            </label>
          </div>

          {/* Controlar stock */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={trackStock}
              onChange={e => setTrackStock(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
            <span className="text-sm text-[#0f172a]">Controlar stock</span>
          </label>

          {/* Proveedor + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Proveedor</span>
              <input
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="Nombre del proveedor"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>SKU / código interno</span>
              <input
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="SKU-001"
                className={inputClass}
              />
            </label>
          </div>

          {/* Disponible + Visible */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={e => setIsAvailable(e.target.checked)}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-[#0f172a]">Disponible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={e => setIsVisible(e.target.checked)}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-[#0f172a]">Visible en carta</span>
            </label>
          </div>

        </div>

        {/* Footer fijo */}
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex-shrink-0">
          {error && (
            <p className="text-red-600 text-xs mb-3">{error}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Guardar producto'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: error en `ProductsClient` (prop `categories` aún no aceptada) — se resuelve en Task 4.

- [ ] **Step 3: Commit**

```powershell
git add components/productos/AddProductPanel.tsx
git commit -m "feat: add AddProductPanel slide-over component"
```

---

## Task 4: Integrar botón y panel en `ProductsClient`

**Files:**
- Modify: `app/productos/ProductsClient.tsx`

- [ ] **Step 1: Reemplazar el contenido de `app/productos/ProductsClient.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
import { getProductos } from '@/app/actions/productos'
import ProductRow from '@/components/productos/ProductRow'
import AddProductPanel from '@/components/productos/AddProductPanel'

interface Props {
  initialProducts: ProductoConCategoria[]
  categories: Categoria[]
}

export default function ProductsClient({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
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
      {/* Barra de filtros */}
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
            Stock bajo ({lowStockCount})
          </button>
        )}
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="px-3 py-2 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 disabled:opacity-50"
        >
          {isPending ? 'Actualizando...' : 'Actualizar'}
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span> Añadir producto
        </button>
      </div>

      {/* Tabla */}
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

      {/* Panel lateral */}
      {showAdd && (
        <AddProductPanel
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSaved={handleRefresh}
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
git add app/productos/ProductsClient.tsx
git commit -m "feat: integrate AddProductPanel button in ProductsClient"
```

---

## Task 5: Build final y verificación

- [ ] **Step 1: Build de producción**

```powershell
npm run build
```

Resultado esperado:
```
✓ Compiled successfully
Route (app)
...
├ ƒ /productos
...
```

- [ ] **Step 2: Commit final y push**

```powershell
git add -A
git commit -m "feat: add product slide-over panel with createProduct action"
git push
```

---

## Self-Review

### Cobertura del spec

| Requisito | Tarea |
|-----------|-------|
| Botón "+ Añadir producto" arriba a la derecha, azul | Task 4 (`ProductsClient`) |
| Panel lateral que se desliza desde la derecha | Task 3 (`AddProductPanel`) |
| 13 campos del formulario | Task 3 |
| Validaciones cliente (nombre, categoría, precio, coste) | Task 3 |
| `createProduct` con `restaurant_id` del usuario | Task 1 |
| `position = MAX + 1` por categoría | Task 1 |
| `stock_movements` con `'Stock inicial'` si `trackStock && stock > 0` | Task 1 |
| Devuelve `{ success: true }` o `{ error: 'mensaje' }` | Task 1 |
| Cierra y refresca la lista al guardar | Task 3 (`onSaved` → `handleRefresh`) |
| Limpia y cierra al cancelar (desmontaje del componente) | Task 3 + Task 4 |
| Todo en español | ✓ todos los mensajes |
| TypeScript sin `any` | ✓ todos los tipos explícitos |
| Misma estética que el resto de la app | ✓ mismas clases Tailwind |
| Loading state mientras guarda | ✓ `isPending` en `useTransition` |
| No modifica `lib/supabase/server.ts` ni auth | ✓ sin tocar |
