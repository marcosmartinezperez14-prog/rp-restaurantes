# Multi-Categoría en Productos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaptar el código para que cada producto pueda pertenecer a múltiples categorías usando la tabla de relación `product_categories` ya creada en Supabase.

**Architecture:** La migración DB ya está aplicada (`category_id` eliminado de `products`, datos migrados a `product_categories`). Se actualiza el tipo `ProductoConCategoria` para usar `categories: { id: string; name: string }[]`, luego se adaptan las server actions y los componentes UI en orden de dependencia.

**Tech Stack:** Next.js 16.2.6 · React 19 · TypeScript 5 strict · Tailwind v4 · @supabase/ssr v0.10.3

> **Verificación por tarea:** `npx tsc --noEmit`. Las tareas 1–3 producirán errores TS en otros ficheros — es esperado, se resuelven en la tarea siguiente. Sin errores en los ficheros modificados en esa tarea. Verificación final: `npm run build`.

---

## File Map

| Fichero | Estado | Responsabilidad |
|---------|--------|----------------|
| `app/actions/productos.ts` | Modificar | Tipo `ProductoConCategoria`, `getProductos`, `createProduct`, `updateProducto`, `deleteCategoria` |
| `components/productos/ProductRow.tsx` | Modificar | Prop `allCategories`, mostrar array de categorías, pasar a `EditProductModal` |
| `components/productos/EditProductModal.tsx` | Modificar | Prop `allCategories`, checkboxes multi-select de categorías |
| `components/productos/AddProductPanel.tsx` | Modificar | `selectedCategoryIds[]`, checkboxes en lugar de `<select>` único |
| `app/productos/ProductsClient.tsx` | Modificar | Pasar `allCategories` a `ProductRow`, actualizar búsqueda |

---

## Task 1: Actualizar server actions y tipo

**Files:**
- Modify: `app/actions/productos.ts`

- [ ] **Step 1: Actualizar el tipo `ProductoConCategoria`**

Reemplaza las líneas del tipo `ProductoConCategoria` completo (desde `export type ProductoConCategoria = {` hasta su `}`):

```typescript
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
  categories: { id: string; name: string }[]
}
```

- [ ] **Step 2: Reemplazar `getProductos` completo**

Reemplaza la función `getProductos` completa:

```typescript
export async function getProductos(): Promise<ProductoConCategoria[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('products')
    .select(`
      id, name, price, cost_price, tax_rate, is_available, is_visible,
      track_stock, stock, stock_min, supplier, last_purchase_date,
      product_categories(category_id, categories(id, name))
    `)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('name')

  type PCRow = { category_id: string; categories: { id: string; name: string } | null }

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
    categories: ((p.product_categories ?? []) as PCRow[]).map(pc => ({
      id: pc.category_id,
      name: pc.categories?.name ?? '—',
    })),
  }))
}
```

- [ ] **Step 3: Actualizar `updateProducto` — añadir `categoryIds`**

Reemplaza la función `updateProducto` completa:

```typescript
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
    categoryIds?: string[]
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { categoryIds, ...productData } = data

  if (Object.keys(productData).length > 0) {
    const { error } = await supabase
      .from('products')
      .update({ ...productData, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('restaurant_id', restaurantId)
    if (error) return { error: error.message }
  }

  if (categoryIds !== undefined) {
    const { error: delErr } = await supabase
      .from('product_categories')
      .delete()
      .eq('product_id', productId)
      .eq('restaurant_id', restaurantId)
    if (delErr) return { error: delErr.message }

    if (categoryIds.length > 0) {
      const { error: insErr } = await supabase
        .from('product_categories')
        .insert(categoryIds.map(cid => ({
          product_id: productId,
          category_id: cid,
          restaurant_id: restaurantId,
        })))
      if (insErr) return { error: insErr.message }
    }
  }

  return {}
}
```

- [ ] **Step 4: Actualizar `createProduct` — usar `categoryIds[]` y sin `position`**

Reemplaza la función `createProduct` completa:

```typescript
export async function createProduct(params: {
  name: string
  categoryIds: string[]
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
  if (params.price <= 0) return { error: 'El precio de venta debe ser mayor que 0' }
  if (params.costPrice !== undefined && params.costPrice < 0) {
    return { error: 'El precio de compra no puede ser negativo' }
  }

  const { data: product, error: insertErr } = await supabase
    .from('products')
    .insert({
      restaurant_id: restaurantId,
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
    })
    .select('id')
    .single()

  if (insertErr || !product) {
    return { error: insertErr?.message ?? 'No se pudo crear el producto' }
  }

  if (params.categoryIds.length > 0) {
    const { error: catErr } = await supabase
      .from('product_categories')
      .insert(params.categoryIds.map(cid => ({
        product_id: product.id,
        category_id: cid,
        restaurant_id: restaurantId,
      })))
    if (catErr) return { error: catErr.message }
  }

  if (params.trackStock && params.stock > 0) {
    const { error: movErr } = await supabase.from('stock_movements').insert({
      restaurant_id: restaurantId,
      product_id: product.id,
      type: 'ajuste',
      quantity: params.stock,
      cost_price: params.costPrice ?? null,
      purchase_date: null,
      notes: 'Stock inicial',
      created_by: user.id,
    })
    if (movErr) return { error: `Producto creado pero error al registrar stock: ${movErr.message}` }
  }

  return { success: true }
}
```

- [ ] **Step 5: Actualizar `deleteCategoria` — contar en `product_categories`**

En la función `deleteCategoria`, localiza el bloque `const { count } = await supabase...` y reemplázalo:

```typescript
  const { count } = await supabase
    .from('product_categories')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('restaurant_id', restaurantId)
```

(Elimina el `.is('deleted_at', null)` que tenía la versión anterior — `product_categories` no tiene esa columna.)

- [ ] **Step 6: Verificar TypeScript en este fichero**

```powershell
npx tsc --noEmit 2>&1 | Select-String "productos.ts"
```

Resultado esperado: sin errores en `app/actions/productos.ts`. Habrá errores en otros ficheros (ProductRow, EditProductModal, AddProductPanel) — son esperados y se resuelven en tareas siguientes.

- [ ] **Step 7: Commit**

```powershell
git add app/actions/productos.ts
git commit -m "feat: update productos actions and type for multi-category (product_categories)"
```

---

## Task 2: Actualizar `ProductRow` y `EditProductModal`

**Files:**
- Modify: `components/productos/ProductRow.tsx`
- Modify: `components/productos/EditProductModal.tsx`

- [ ] **Step 1: Reemplazar `components/productos/EditProductModal.tsx` completo**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
import { updateProducto } from '@/app/actions/productos'

interface Props {
  product: ProductoConCategoria
  allCategories: Categoria[]
  onClose: () => void
  onSaved: () => void
}

export default function EditProductModal({ product, allCategories, onClose, onSaved }: Props) {
  const [price, setPrice] = useState(product.price.toFixed(2))
  const [costPrice, setCostPrice] = useState(product.cost_price?.toFixed(2) ?? '')
  const [stockMin, setStockMin] = useState(product.stock_min?.toString() ?? '')
  const [supplier, setSupplier] = useState(product.supplier ?? '')
  const [trackStock, setTrackStock] = useState(product.track_stock)
  const [isAvailable, setIsAvailable] = useState(product.is_available)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    product.categories.map(c => c.id)
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleCategory(id: string) {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

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
        categoryIds: selectedCategoryIds,
      })
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const categoryNames = product.categories.map(c => c.name).join(', ') || '—'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-bold text-[#0f172a]">{product.name}</h2>
          <p className="text-xs text-[#64748b]">{categoryNames}</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Precio venta (€)</span>
              <input value={price} onChange={e => setPrice(e.target.value)}
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Precio coste (€)</span>
              <input value={costPrice} onChange={e => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Proveedor</span>
            <input value={supplier} onChange={e => setSupplier(e.target.value)}
              placeholder="Nombre del proveedor"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Stock mínimo</span>
            <input value={stockMin} onChange={e => setStockMin(e.target.value)}
              type="number" min="0" placeholder="0"
              className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400" />
          </label>
          {/* Categorías */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#64748b]">Categorías</span>
            <div className="border border-[#e2e8f0] rounded-lg p-2 flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {allCategories.length === 0 && (
                <p className="text-xs text-[#94a3b8] py-1 px-1">Sin categorías disponibles</p>
              )}
              {allCategories.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-slate-50 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className="text-sm text-[#0f172a]">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
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

- [ ] **Step 2: Reemplazar `components/productos/ProductRow.tsx` completo**

```tsx
'use client'

import { useState } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
import EditProductModal from './EditProductModal'
import PurchaseModal from './PurchaseModal'
import StockModal from './StockModal'
import StockHistory from './StockHistory'

interface Props {
  product: ProductoConCategoria
  allCategories: Categoria[]
  onRefresh: () => void
}

export default function ProductRow({ product, allCategories, onRefresh }: Props) {
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

  const categoryLabel = product.categories.length > 0
    ? product.categories.map(c => c.name).join(', ')
    : '—'

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
        <td className="px-4 py-3 text-xs text-[#64748b]">{categoryLabel}</td>
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
        <EditProductModal
          product={product}
          allCategories={allCategories}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
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

- [ ] **Step 3: Verificar TypeScript en estos ficheros**

```powershell
npx tsc --noEmit 2>&1 | Select-String "ProductRow|EditProduct"
```

Resultado esperado: sin errores en estos dos ficheros. Puede haber errores en `AddProductPanel` y `ProductsClient` — son esperados.

- [ ] **Step 4: Commit**

```powershell
git add components/productos/ProductRow.tsx components/productos/EditProductModal.tsx
git commit -m "feat: update ProductRow and EditProductModal for multi-category"
```

---

## Task 3: Actualizar `AddProductPanel`

**Files:**
- Modify: `components/productos/AddProductPanel.tsx`

- [ ] **Step 1: Reemplazar `components/productos/AddProductPanel.tsx` completo**

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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
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

  function toggleCategory(id: string) {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSave() {
    const priceNum = parseFloat(price.replace(',', '.'))
    const costNum = costPrice.trim() ? parseFloat(costPrice.replace(',', '.')) : undefined
    const stockNum = parseFloat(stock) || 0
    const stockMinNum = parseFloat(stockMin) || 0

    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (isNaN(priceNum) || priceNum <= 0) { setError('El precio de venta debe ser mayor que 0'); return }
    if (costNum !== undefined && (isNaN(costNum) || costNum < 0)) {
      setError('El precio de compra no puede ser negativo')
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await createProduct({
        name,
        categoryIds: selectedCategoryIds,
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

  const inputClass = 'border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 w-full'
  const labelClass = 'flex flex-col gap-1'
  const labelTextClass = 'text-xs font-medium text-[#64748b]'

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
          <h2 className="text-[15px] font-bold text-[#0f172a]">Nuevo producto</h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#0f172a] text-xl leading-none">✕</button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Nombre */}
          <label className={labelClass}>
            <span className={labelTextClass}>Nombre *</span>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Coca-Cola 33cl" className={inputClass} />
          </label>

          {/* Categorías */}
          <div className={labelClass}>
            <span className={labelTextClass}>Categorías</span>
            <div className="border border-[#e2e8f0] rounded-lg p-2 flex flex-col gap-0.5 max-h-36 overflow-y-auto">
              {categories.length === 0 && (
                <p className="text-xs text-[#94a3b8] py-1 px-1">Sin categorías disponibles</p>
              )}
              {categories.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-slate-50 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className="text-sm text-[#0f172a]">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <label className={labelClass}>
            <span className={labelTextClass}>Descripción</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Descripción opcional del producto..."
              className={`${inputClass} resize-none`} />
          </label>

          {/* Precio venta + Precio compra */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Precio venta (€) *</span>
              <input value={price} onChange={e => setPrice(e.target.value)}
                type="number" min="0.01" step="0.01" placeholder="0.00" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Precio compra (€)</span>
              <input value={costPrice} onChange={e => setCostPrice(e.target.value)}
                type="number" min="0" step="0.01" placeholder="0.00" className={inputClass} />
            </label>
          </div>

          {/* IVA */}
          <label className={labelClass}>
            <span className={labelTextClass}>IVA aplicable *</span>
            <select value={taxRate} onChange={e => setTaxRate(Number(e.target.value))}
              className={`${inputClass} bg-white`}>
              {TAX_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {/* Stock actual + Stock mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Stock actual</span>
              <input value={stock} onChange={e => setStock(e.target.value)}
                type="number" min="0" step="0.001" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Stock mínimo</span>
              <input value={stockMin} onChange={e => setStockMin(e.target.value)}
                type="number" min="0" step="0.001" className={inputClass} />
            </label>
          </div>

          {/* Controlar stock */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={trackStock} onChange={e => setTrackStock(e.target.checked)}
              className="accent-blue-600 w-4 h-4" />
            <span className="text-sm text-[#0f172a]">Controlar stock</span>
          </label>

          {/* Proveedor + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Proveedor</span>
              <input value={supplier} onChange={e => setSupplier(e.target.value)}
                placeholder="Nombre del proveedor" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>SKU / código interno</span>
              <input value={sku} onChange={e => setSku(e.target.value)}
                placeholder="SKU-001" className={inputClass} />
            </label>
          </div>

          {/* Disponible + Visible */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)}
                className="accent-blue-600 w-4 h-4" />
              <span className="text-sm text-[#0f172a]">Disponible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isVisible} onChange={e => setIsVisible(e.target.checked)}
                className="accent-blue-600 w-4 h-4" />
              <span className="text-sm text-[#0f172a]">Visible en carta</span>
            </label>
          </div>

        </div>

        {/* Footer fijo */}
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex-shrink-0">
          {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={onClose}
              className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isPending ? 'Guardando...' : 'Guardar producto'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript en este fichero**

```powershell
npx tsc --noEmit 2>&1 | Select-String "AddProductPanel"
```

Resultado esperado: sin errores en `AddProductPanel`. Puede haber error en `ProductsClient` (falta `allCategories` en `ProductRow`) — esperado, se resuelve en Task 4.

- [ ] **Step 3: Commit**

```powershell
git add components/productos/AddProductPanel.tsx
git commit -m "feat: update AddProductPanel to multi-category checkboxes"
```

---

## Task 4: Actualizar `ProductsClient`

**Files:**
- Modify: `app/productos/ProductsClient.tsx`

- [ ] **Step 1: Reemplazar `app/productos/ProductsClient.tsx` completo**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
import { getProductos, getCategorias } from '@/app/actions/productos'
import ProductRow from '@/components/productos/ProductRow'
import AddProductPanel from '@/components/productos/AddProductPanel'
import CategoriasPanel from '@/components/productos/CategoriasPanel'

interface Props {
  initialProducts: ProductoConCategoria[]
  initialCategories: Categoria[]
}

export default function ProductsClient({ initialProducts, initialCategories }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [categories, setCategories] = useState(initialCategories)
  const [search, setSearch] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showCategorias, setShowCategorias] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getProductos()
      setProducts(fresh)
    })
  }

  function refreshCategories() {
    startTransition(async () => {
      const fresh = await getCategorias()
      setCategories(fresh)
    })
  }

  function handleCategoriaChanged() {
    refreshCategories()
    handleRefresh()
  }

  const visible = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      || p.categories.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
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
          onClick={() => setShowCategorias(true)}
          className="px-4 py-2 text-sm border border-[#e2e8f0] bg-white rounded-lg text-[#64748b] hover:bg-slate-50 font-medium"
        >
          Categorías
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
              <ProductRow
                key={product.id}
                product={product}
                allCategories={categories}
                onRefresh={handleRefresh}
              />
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

      {/* Panel añadir producto */}
      {showAdd && (
        <AddProductPanel
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSaved={handleRefresh}
        />
      )}

      {/* Panel categorías */}
      {showCategorias && (
        <CategoriasPanel
          categories={categories}
          onClose={() => setShowCategorias(false)}
          onChanged={handleCategoriaChanged}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript — cero errores**

```powershell
npx tsc --noEmit
```

Resultado esperado: **sin errores**.

- [ ] **Step 3: Commit**

```powershell
git add app/productos/ProductsClient.tsx
git commit -m "feat: pass allCategories to ProductRow, fix search for multi-category"
```

---

## Task 5: Build final y push

- [ ] **Step 1: Build de producción**

```powershell
npm run build
```

Resultado esperado:
```
✓ Compiled successfully
...
├ ƒ /productos
...
```

- [ ] **Step 2: Push**

```powershell
git push
```

---

## Self-Review

### Cobertura del spec

| Requisito | Tarea |
|-----------|-------|
| `ProductoConCategoria` usa `categories[]` en lugar de `category_id`+`category_name` | Task 1 |
| `getProductos` hace JOIN con `product_categories` + `categories` | Task 1 |
| `createProduct` acepta `categoryIds[]`, inserta en `product_categories` | Task 1 |
| `createProduct` sin `category_id` en el insert de `products` | Task 1 |
| `updateProducto` acepta `categoryIds?` y hace replace completo | Task 1 |
| `deleteCategoria` cuenta en `product_categories` | Task 1 |
| `EditProductModal` muestra checkboxes con categorías actuales pre-marcadas | Task 2 |
| `ProductRow` muestra múltiples categorías separadas por coma | Task 2 |
| `ProductRow` pasa `allCategories` a `EditProductModal` | Task 2 |
| `AddProductPanel` usa checkboxes en lugar de select único | Task 3 |
| `ProductsClient` pasa `allCategories={categories}` a `ProductRow` | Task 4 |
| Búsqueda por categoría funciona con array (`.some()`) | Task 4 |
| TypeScript sin `any` | ✓ todos los tipos explícitos |
