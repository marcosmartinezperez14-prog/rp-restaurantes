# Carta Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un módulo de Carta (platos de menú) a la página de productos existente, con ingredientes, cálculo de coste/margen en tiempo real y CRUD completo; y extender los productos base con el campo `unit` (kg/g/l/ml/unit/dozen).

**Architecture:** La página `/productos` añade un sistema de tabs (`productos` | `carta`). El tab de productos es el componente existente sin cambios. El tab de carta es un nuevo `CartaClient` con grid de `MenuItemCard` y un slide-over `MenuItemFormPanel` para crear/editar platos con selector de ingredientes interactivo. Todas las acciones viven en `app/actions/productos.ts` siguiendo el patrón existente.

**Tech Stack:** Next.js 16.2.6 App Router · React 19 · TypeScript strict · Tailwind v4 · Supabase JS v2 · Supabase Storage (bucket `products`)

> **Verification per task:** `npx tsc --noEmit`. Final: `npm run build`.

---

## File Map

| Archivo | Estado | Responsabilidad |
|---------|--------|-----------------|
| `docs/migrations/2026-06-05-carta.sql` | Crear | Migración SQL: columna `unit` en products, tablas `menu_items` y `menu_item_ingredients` |
| `app/actions/productos.ts` | Modificar | Añadir `ProductUnit`, `unit` a `ProductoConCategoria`, `MenuItem`, `MenuItemIngredient`; acciones CRUD de menu_items; `unit` en create/update producto |
| `app/productos/page.tsx` | Modificar | Cargar `getMenuItems()` en paralelo con los datos existentes |
| `app/productos/ProductsClient.tsx` | Modificar | Añadir estado `activeTab`, renderizar tabs UI, pasar props a CartaClient |
| `components/productos/AddProductPanel.tsx` | Modificar | Añadir select de `unit` |
| `components/productos/EditProductModal.tsx` | Modificar | Añadir select de `unit` |
| `app/productos/CartaClient.tsx` | Crear | Client component del tab Carta: grid, filtros por categoría, abrir panel |
| `components/carta/MenuItemCard.tsx` | Crear | Tarjeta de plato: nombre, precio, coste, margen con color, ingredientes |
| `components/carta/MenuItemFormPanel.tsx` | Crear | Slide-over: form de plato + selector de ingredientes + cálculo live |

---

## Task 1: SQL Migration

**Files:**
- Crear: `docs/migrations/2026-06-05-carta.sql`

> ⚠️ Este SQL debe ejecutarse manualmente en el **SQL Editor de Supabase** antes de ejecutar las siguientes tareas.

- [ ] **Step 1: Crear el directorio y el archivo de migración**

```powershell
New-Item -ItemType Directory -Force -Path docs/migrations
```

Crear `docs/migrations/2026-06-05-carta.sql` con el siguiente contenido:

```sql
-- ============================================================
-- Migration: 2026-06-05 — Carta module
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add unit column to products (NOT NULL with safe default)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'unit';

-- 2. Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create menu_item_ingredients table
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id   UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  quantity       NUMERIC(10,4) NOT NULL,
  unit           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS menu_items_restaurant_idx       ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS menu_items_deleted_idx          ON menu_items(deleted_at);
CREATE INDEX IF NOT EXISTS mii_menu_item_idx               ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS mii_product_idx                 ON menu_item_ingredients(product_id);

-- 5. Row Level Security
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_items_restaurant" ON menu_items;
CREATE POLICY "menu_items_restaurant" ON menu_items
  FOR ALL USING (restaurant_id = get_current_restaurant_id());

ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mii_restaurant" ON menu_item_ingredients;
CREATE POLICY "mii_restaurant" ON menu_item_ingredients
  FOR ALL USING (restaurant_id = get_current_restaurant_id());
```

- [ ] **Step 2: Ejecutar la migración en Supabase**

Abre el **SQL Editor** en el dashboard de Supabase y ejecuta el contenido del archivo anterior. Verifica que no hay errores.

- [ ] **Step 3: Commit**

```powershell
git add docs/migrations/2026-06-05-carta.sql
git commit -m "docs: add carta SQL migration (unit on products, menu_items, menu_item_ingredients)"
```

---

## Task 2: Types + Server Actions — unit en productos + CRUD menu_items

**Files:**
- Modificar: `app/actions/productos.ts`

- [ ] **Step 1: Añadir `ProductUnit` y `unit` a `ProductoConCategoria`**

En `app/actions/productos.ts`, tras la línea `'use server'` e imports, añade el nuevo tipo justo antes de `ProductoConCategoria` y añade el campo `unit`:

```typescript
export type ProductUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'dozen'
```

Modifica el tipo `ProductoConCategoria` para añadir `unit`:

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
  unit: ProductUnit
  supplier: string | null
  last_purchase_date: string | null
  categories: { id: string; name: string }[]
}
```

- [ ] **Step 2: Añadir tipos `MenuItem` y `MenuItemIngredient`**

Justo después del tipo `Categoria`, añade:

```typescript
export type MenuItemIngredient = {
  id: string
  menu_item_id: string
  product_id: string
  restaurant_id: string
  quantity: number
  unit: string
  product?: {
    id: string
    name: string
    cost_price: number | null
    unit: ProductUnit
  }
}

export type MenuItem = {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  category?: { name: string }
  ingredients: MenuItemIngredient[]
}
```

- [ ] **Step 3: Actualizar `getProductos` para incluir `unit`**

En la query de `getProductos`, añade `unit` al select:

```typescript
const { data } = await supabase
  .from('products')
  .select(`
    id, name, price, cost_price, tax_rate, is_available, is_visible,
    track_stock, stock, stock_min, unit, supplier, last_purchase_date,
    product_categories(category_id, categories(id, name))
  `)
  .eq('restaurant_id', restaurantId)
  .is('deleted_at', null)
  .order('name')
```

Y en el `.map()` añade el campo `unit`:

```typescript
unit: (p.unit as ProductUnit) ?? 'unit',
```

(Añadir junto a los demás campos, por ejemplo entre `stock_min` y `supplier`.)

- [ ] **Step 4: Actualizar `updateProducto` para aceptar `unit`**

Añade `unit?: ProductUnit` al objeto `data` de `updateProducto`:

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
    unit?: ProductUnit
    categoryIds?: string[]
  }
): Promise<{ error?: string }> {
```

No hay más cambios en el cuerpo — `unit` ya se incluirá en `productData` gracias al spread `{ ...productData, updated_at: ... }`.

- [ ] **Step 5: Actualizar `createProduct` para aceptar `unit`**

En los parámetros de `createProduct` añade:

```typescript
unit?: ProductUnit
```

Y en el `.insert({...})`:

```typescript
unit: params.unit ?? 'unit',
```

Añadir junto a los demás campos del insert.

- [ ] **Step 6: Añadir `getMenuItems` al final del archivo**

```typescript
export async function getMenuItems(): Promise<MenuItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('menu_items')
    .select(`
      id, restaurant_id, category_id, name, description, price,
      image_url, is_active, deleted_at, created_at, updated_at,
      categories(name),
      menu_item_ingredients(
        id, menu_item_id, product_id, restaurant_id, quantity, unit,
        products(id, name, cost_price, unit)
      )
    `)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('name')

  return (data ?? []).map(item => ({
    id: item.id,
    restaurant_id: item.restaurant_id,
    category_id: item.category_id ?? null,
    name: item.name,
    description: item.description ?? null,
    price: Number(item.price),
    image_url: item.image_url ?? null,
    is_active: item.is_active,
    deleted_at: item.deleted_at ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    category: item.categories ? { name: (item.categories as { name: string }).name } : undefined,
    ingredients: ((item.menu_item_ingredients ?? []) as Array<{
      id: string; menu_item_id: string; product_id: string; restaurant_id: string
      quantity: number | string; unit: string
      products: { id: string; name: string; cost_price: number | null; unit: string } | null
    }>).map(ing => ({
      id: ing.id,
      menu_item_id: ing.menu_item_id,
      product_id: ing.product_id,
      restaurant_id: ing.restaurant_id,
      quantity: Number(ing.quantity),
      unit: ing.unit,
      product: ing.products ? {
        id: ing.products.id,
        name: ing.products.name,
        cost_price: ing.products.cost_price !== null ? Number(ing.products.cost_price) : null,
        unit: ing.products.unit as ProductUnit,
      } : undefined,
    })),
  }))
}
```

- [ ] **Step 7: Añadir `createMenuItem` al final del archivo**

```typescript
export async function createMenuItem(params: {
  name: string
  description?: string
  categoryId?: string
  price: number
  imageUrl?: string
  isActive: boolean
  ingredients: { productId: string; quantity: number; unit: string }[]
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!params.name.trim()) return { error: 'El nombre es obligatorio' }
  if (params.price < 0) return { error: 'El precio no puede ser negativo' }

  const { data: item, error: insertErr } = await supabase
    .from('menu_items')
    .insert({
      restaurant_id: restaurantId,
      category_id: params.categoryId || null,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      price: params.price,
      image_url: params.imageUrl || null,
      is_active: params.isActive,
    })
    .select('id')
    .single()

  if (insertErr || !item) return { error: insertErr?.message ?? 'No se pudo crear el plato' }

  if (params.ingredients.length > 0) {
    const { error: ingErr } = await supabase
      .from('menu_item_ingredients')
      .insert(params.ingredients.map(ing => ({
        menu_item_id: item.id,
        product_id: ing.productId,
        restaurant_id: restaurantId,
        quantity: ing.quantity,
        unit: ing.unit,
      })))
    if (ingErr) return { error: `Plato creado pero error en ingredientes: ${ingErr.message}` }
  }

  return { success: true }
}
```

- [ ] **Step 8: Añadir `updateMenuItem` al final del archivo**

```typescript
export async function updateMenuItem(
  itemId: string,
  params: {
    name?: string
    description?: string | null
    categoryId?: string | null
    price?: number
    imageUrl?: string | null
    isActive?: boolean
    ingredients?: { productId: string; quantity: number; unit: string }[]
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (params.name !== undefined) updateData.name = params.name.trim()
  if (params.description !== undefined) updateData.description = params.description?.trim() || null
  if (params.categoryId !== undefined) updateData.category_id = params.categoryId || null
  if (params.price !== undefined) updateData.price = params.price
  if (params.imageUrl !== undefined) updateData.image_url = params.imageUrl || null
  if (params.isActive !== undefined) updateData.is_active = params.isActive

  const { error: updateErr } = await supabase
    .from('menu_items')
    .update(updateData)
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
  if (updateErr) return { error: updateErr.message }

  if (params.ingredients !== undefined) {
    const { error: delErr } = await supabase
      .from('menu_item_ingredients')
      .delete()
      .eq('menu_item_id', itemId)
      .eq('restaurant_id', restaurantId)
    if (delErr) return { error: delErr.message }

    if (params.ingredients.length > 0) {
      const { error: ingErr } = await supabase
        .from('menu_item_ingredients')
        .insert(params.ingredients.map(ing => ({
          menu_item_id: itemId,
          product_id: ing.productId,
          restaurant_id: restaurantId,
          quantity: ing.quantity,
          unit: ing.unit,
        })))
      if (ingErr) return { error: ingErr.message }
    }
  }

  return {}
}
```

- [ ] **Step 9: Añadir `deleteMenuItem` al final del archivo**

```typescript
export async function deleteMenuItem(itemId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { error } = await supabase
    .from('menu_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 10: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 11: Commit**

```powershell
git add app/actions/productos.ts
git commit -m "feat: add unit to products, MenuItem types and CRUD server actions"
```

---

## Task 3: AddProductPanel + EditProductModal — campo unit

**Files:**
- Modificar: `components/productos/AddProductPanel.tsx`
- Modificar: `components/productos/EditProductModal.tsx`

- [ ] **Step 1: Añadir select de `unit` en `AddProductPanel`**

En `components/productos/AddProductPanel.tsx`:

Añade la constante de opciones al principio del archivo (tras los imports):

```typescript
const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'unit',   label: 'Unidad' },
  { value: 'kg',     label: 'Kilogramo (kg)' },
  { value: 'g',      label: 'Gramo (g)' },
  { value: 'l',      label: 'Litro (l)' },
  { value: 'ml',     label: 'Mililitro (ml)' },
  { value: 'dozen',  label: 'Docena' },
]
```

Añade estado justo después de los otros `useState`:

```typescript
const [unit, setUnit] = useState<string>('unit')
```

En el `handleSave`, añade `unit` al objeto que se pasa a `createProduct`:

```typescript
const res = await createProduct({
  // ... existing fields ...
  unit: unit as import('@/app/actions/productos').ProductUnit,
})
```

Añade el campo visual tras el campo de stock mínimo (dentro del form body):

```tsx
<label className={labelClass}>
  <span className={labelTextClass}>Unidad de medida</span>
  <select
    value={unit}
    onChange={e => setUnit(e.target.value)}
    className={inputClass}
  >
    {UNIT_OPTIONS.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
</label>
```

- [ ] **Step 2: Añadir select de `unit` en `EditProductModal`**

En `components/productos/EditProductModal.tsx`:

Añade la misma constante `UNIT_OPTIONS` al principio.

Añade estado inicializado desde el producto:

```typescript
const [unit, setUnit] = useState<string>(product.unit ?? 'unit')
```

En `handleSave`, añade `unit` al objeto `updateProducto`:

```typescript
const res = await updateProducto(product.id, {
  // ... existing fields ...
  unit: unit as import('@/app/actions/productos').ProductUnit,
})
```

Añade el campo select en el JSX (en un lugar lógico dentro del form):

```tsx
<div className="flex flex-col gap-1">
  <label className="text-xs font-medium text-[#64748b]">Unidad de medida</label>
  <select
    value={unit}
    onChange={e => setUnit(e.target.value)}
    className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400"
  >
    {UNIT_OPTIONS.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add components/productos/AddProductPanel.tsx components/productos/EditProductModal.tsx
git commit -m "feat: add unit field to AddProductPanel and EditProductModal"
```

---

## Task 4: Page + ProductsClient — sistema de tabs

**Files:**
- Modificar: `app/productos/page.tsx`
- Modificar: `app/productos/ProductsClient.tsx`

- [ ] **Step 1: Actualizar `app/productos/page.tsx`**

Reemplaza el contenido de `app/productos/page.tsx` con:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos, getCategorias, getMenuItems } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import ProductsClient from './ProductsClient'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [products, categories, menuItems] = await Promise.all([
    getProductos(),
    getCategorias(),
    getMenuItems(),
  ])

  return (
    <AppShell title="Productos e Inventario">
      <ProductsClient
        initialProducts={products}
        initialCategories={categories}
        initialMenuItems={menuItems}
      />
    </AppShell>
  )
}
```

- [ ] **Step 2: Actualizar `ProductsClient.tsx` — añadir tabs**

Modifica el tipo `Props` añadiendo `initialMenuItems`:

```typescript
import type { ProductoConCategoria, Categoria, MenuItem } from '@/app/actions/productos'
import { getProductos, getCategorias, getMenuItems } from '@/app/actions/productos'
import CartaClient from './CartaClient'
```

```typescript
interface Props {
  initialProducts: ProductoConCategoria[]
  initialCategories: Categoria[]
  initialMenuItems: MenuItem[]
}
```

Añade estado de tab y la prop:

```typescript
export default function ProductsClient({ initialProducts, initialCategories, initialMenuItems }: Props) {
  const [activeTab, setActiveTab] = useState<'productos' | 'carta'>('productos')
  // ... existing state ...
```

Añade justo antes del `return (`:

```typescript
  function handleRefreshMenuItems() {
    startTransition(async () => {
      // CartaClient handles its own refresh; this is a no-op placeholder
    })
  }
```

Envuelve todo el JSX existente en un fragmento con los tabs. Reemplaza el `return (` completo con:

```tsx
  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[#e2e8f0]">
        <button
          onClick={() => setActiveTab('productos')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'productos'
              ? 'border-blue-600 text-blue-700 bg-blue-50'
              : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          📦 Productos
        </button>
        <button
          onClick={() => setActiveTab('carta')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'carta'
              ? 'border-blue-600 text-blue-700 bg-blue-50'
              : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          🍽️ Carta
        </button>
      </div>

      {activeTab === 'productos' && (
        <>
          {/* AQUÍ VA EXACTAMENTE TODO EL JSX EXISTENTE de ProductsClient, desde la barra de filtros hasta el </div> final, sin cambios */}
          {/* Barra de filtros */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* ... todo el contenido existente sin modificar ... */}
          </div>
          {/* ... tabla, panels, etc. ... */}
        </>
      )}

      {activeTab === 'carta' && (
        <CartaClient
          initialMenuItems={initialMenuItems}
          categories={categories}
          allProducts={products}
          onProductsRefresh={handleRefresh}
        />
      )}
    </div>
  )
```

> **IMPORTANTE:** No borres ni muevas el JSX existente de la sección de productos. Solo añade los tabs encima y envuelve el contenido existente en `{activeTab === 'productos' && (<>...</>)}`. Todo lo que estaba en el return original va dentro de ese bloque.

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: un error sobre `CartaClient` no encontrado (aún no creado) — todos los demás limpios.

- [ ] **Step 4: Commit**

```powershell
git add app/productos/page.tsx app/productos/ProductsClient.tsx
git commit -m "feat: add products/carta tab system to ProductsClient"
```

---

## Task 5: MenuItemCard component

**Files:**
- Crear: `components/carta/MenuItemCard.tsx`

- [ ] **Step 1: Crear el directorio y el componente**

```powershell
New-Item -ItemType Directory -Force -Path components/carta
```

Crea `components/carta/MenuItemCard.tsx`:

```tsx
'use client'

import type { MenuItem } from '@/app/actions/productos'
import { useTransition } from 'react'
import { updateMenuItem, deleteMenuItem } from '@/app/actions/productos'

function marginColor(margin: number): string {
  if (margin < 30) return 'text-red-600 bg-red-50'
  if (margin < 60) return 'text-amber-600 bg-amber-50'
  return 'text-green-700 bg-green-50'
}

interface Props {
  item: MenuItem
  onEdit: (item: MenuItem) => void
  onRefresh: () => void
}

export default function MenuItemCard({ item, onEdit, onRefresh }: Props) {
  const [isPending, startTransition] = useTransition()

  const totalCost = item.ingredients.reduce((sum, ing) => {
    return sum + ((ing.product?.cost_price ?? 0) * ing.quantity)
  }, 0)

  const margin = item.price > 0 ? ((item.price - totalCost) / item.price) * 100 : 0
  const marginClass = marginColor(margin)

  function handleToggleActive() {
    startTransition(async () => {
      await updateMenuItem(item.id, { isActive: !item.is_active })
      onRefresh()
    })
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar "${item.name}"?`)) return
    startTransition(async () => {
      await deleteMenuItem(item.id)
      onRefresh()
    })
  }

  return (
    <div className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-opacity ${isPending ? 'opacity-60' : ''} ${!item.is_active ? 'border-[#e2e8f0] opacity-70' : 'border-[#e2e8f0]'}`}>
      {/* Image */}
      {item.image_url && (
        <div className="h-36 bg-slate-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#0f172a] text-sm truncate">{item.name}</span>
              {!item.is_active && (
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-[#64748b]">
                  Inactivo
                </span>
              )}
              {item.category && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                  {item.category.name}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-[#64748b] mt-0.5 line-clamp-2">{item.description}</p>
            )}
          </div>
          <span className="font-bold text-[#0f172a] text-base whitespace-nowrap">
            {item.price.toFixed(2)} €
          </span>
        </div>

        {/* Cost + margin */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#64748b]">
            Coste: <strong>{totalCost.toFixed(2)} €</strong>
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${marginClass}`}>
            {margin.toFixed(0)}% margen
          </span>
        </div>

        {/* Ingredients */}
        {item.ingredients.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase text-[#94a3b8] tracking-wide">
              {item.ingredients.length} ing.
            </span>
            {item.ingredients.slice(0, 3).map(ing => (
              <span key={ing.id} className="text-[10px] px-1.5 py-0.5 bg-slate-50 rounded text-[#64748b]">
                {ing.product?.name ?? ing.product_id} ({ing.quantity}{ing.unit})
              </span>
            ))}
            {item.ingredients.length > 3 && (
              <span className="text-[10px] text-[#94a3b8]">+{item.ingredients.length - 3} más</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-[#f1f5f9] mt-1">
          <button
            onClick={handleToggleActive}
            disabled={isPending}
            className="flex-1 px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 disabled:opacity-50"
          >
            {item.is_active ? 'Desactivar' : 'Activar'}
          </button>
          <button
            onClick={() => onEdit(item)}
            disabled={isPending}
            className="flex-1 px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 disabled:opacity-50"
          >
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="px-2 py-1.5 text-xs border border-red-100 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            ✕
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
git add components/carta/MenuItemCard.tsx
git commit -m "feat: add MenuItemCard component with cost/margin display"
```

---

## Task 6: MenuItemFormPanel — slide-over con selector de ingredientes

**Files:**
- Crear: `components/carta/MenuItemFormPanel.tsx`

- [ ] **Step 1: Crear `components/carta/MenuItemFormPanel.tsx`**

```tsx
'use client'

import { useState, useTransition, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem, MenuItemIngredient, ProductoConCategoria, Categoria, ProductUnit } from '@/app/actions/productos'
import { createMenuItem, updateMenuItem } from '@/app/actions/productos'

const UNIT_OPTIONS = ['unit', 'kg', 'g', 'l', 'ml', 'dozen']

interface IngredientDraft {
  productId: string
  productName: string
  quantity: number
  unit: string
  costPrice: number
}

interface Props {
  item?: MenuItem
  categories: Categoria[]
  allProducts: ProductoConCategoria[]
  onClose: () => void
  onSaved: () => void
}

export default function MenuItemFormPanel({ item, categories, allProducts, onClose, onSaved }: Props) {
  const isEditing = !!item

  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '')
  const [price, setPrice] = useState(item?.price.toFixed(2) ?? '')
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '')
  const [isActive, setIsActive] = useState(item?.is_active ?? true)
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    (item?.ingredients ?? []).map(ing => ({
      productId: ing.product_id,
      productName: ing.product?.name ?? ing.product_id,
      quantity: ing.quantity,
      unit: ing.unit,
      costPrice: ing.product?.cost_price ?? 0,
    }))
  )

  const [ingSearch, setIngSearch] = useState('')
  const [ingQty, setIngQty] = useState('1')
  const [ingUnit, setIngUnit] = useState('unit')
  const [selectedProductId, setSelectedProductId] = useState('')

  const [imageUploading, setImageUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Live cost & margin
  const priceNum = parseFloat(price.replace(',', '.')) || 0
  const totalCost = useMemo(() =>
    ingredients.reduce((sum, ing) => sum + ing.costPrice * ing.quantity, 0),
    [ingredients]
  )
  const margin = priceNum > 0 ? ((priceNum - totalCost) / priceNum) * 100 : 0

  function marginColorClass(m: number): string {
    if (m < 30) return 'text-red-600 font-bold'
    if (m < 60) return 'text-amber-600 font-bold'
    return 'text-green-700 font-bold'
  }

  // Ingredient search
  const filteredProducts = useMemo(() => {
    if (!ingSearch.trim()) return []
    const q = ingSearch.toLowerCase()
    return allProducts
      .filter(p => p.name.toLowerCase().includes(q) && !ingredients.find(i => i.productId === p.id))
      .slice(0, 8)
  }, [ingSearch, allProducts, ingredients])

  function selectProduct(product: ProductoConCategoria) {
    setSelectedProductId(product.id)
    setIngSearch(product.name)
    setIngUnit(product.unit)
  }

  function addIngredient() {
    const qty = parseFloat(ingQty.replace(',', '.'))
    if (!selectedProductId) { setError('Selecciona un producto'); return }
    if (isNaN(qty) || qty <= 0) { setError('La cantidad debe ser mayor que 0'); return }
    const product = allProducts.find(p => p.id === selectedProductId)
    if (!product) return

    setIngredients(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unit: ingUnit,
      costPrice: product.cost_price ?? 0,
    }])
    setIngSearch('')
    setIngQty('1')
    setSelectedProductId('')
    setIngUnit('unit')
    setError(null)
  }

  function removeIngredient(idx: number) {
    setIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleImageUpload(file: File) {
    setImageUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `menu-items/${Date.now()}.${ext}`
    const { data, error: uploadErr } = await supabase.storage
      .from('products')
      .upload(path, file, { upsert: true })
    if (uploadErr || !data) {
      setError('No se pudo subir la imagen')
      setImageUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('products').getPublicUrl(data.path)
    setImageUrl(urlData.publicUrl)
    setImageUploading(false)
  }

  function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (priceNum < 0) { setError('El precio no puede ser negativo'); return }

    setError(null)
    startTransition(async () => {
      const ingPayload = ingredients.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unit: i.unit,
      }))

      let res: { error?: string } | { success: true }
      if (isEditing) {
        res = await updateMenuItem(item.id, {
          name,
          description: description || null,
          categoryId: categoryId || null,
          price: priceNum,
          imageUrl: imageUrl || null,
          isActive,
          ingredients: ingPayload,
        })
      } else {
        res = await createMenuItem({
          name,
          description: description || undefined,
          categoryId: categoryId || undefined,
          price: priceNum,
          imageUrl: imageUrl || undefined,
          isActive,
          ingredients: ingPayload,
        })
      }

      if ('error' in res && res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const inputClass = 'border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 w-full'

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
          <h2 className="text-[15px] font-bold text-[#0f172a]">
            {isEditing ? `Editar: ${item.name}` : 'Nuevo plato'}
          </h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#0f172a] text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Basic fields */}
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Nombre *</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Paella Valenciana" className={inputClass} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Descripción</span>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Descripción breve del plato" className={inputClass + ' resize-none'} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#64748b]">Categoría</span>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#64748b]">Precio de venta (€)</span>
                <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" min="0" className={inputClass} />
              </label>
            </div>

            {/* Image */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Foto</span>
              <div className="flex gap-2">
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="URL de imagen (o sube una)"
                  className={inputClass}
                />
                <label className="flex-shrink-0 cursor-pointer px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 whitespace-nowrap">
                  {imageUploading ? '...' : 'Subir'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file)
                    }}
                  />
                </label>
              </div>
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="preview" className="h-20 w-20 object-cover rounded-lg border border-[#e2e8f0] mt-1" />
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-[#0f172a]">Disponible en carta</span>
            </label>
          </div>

          {/* Live cost + margin */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#64748b]">Coste total ingredientes</div>
              <div className="text-base font-bold text-[#0f172a]">{totalCost.toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-xs text-[#64748b]">Margen</div>
              <div className={`text-base ${marginColorClass(margin)}`}>{margin.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-[#64748b]">Beneficio bruto</div>
              <div className="text-base font-bold text-[#0f172a]">{(priceNum - totalCost).toFixed(2)} €</div>
            </div>
          </div>

          {/* Ingredients section */}
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-2">
              Ingredientes ({ingredients.length})
            </div>

            {/* Ingredient search */}
            <div className="flex flex-col gap-2 mb-3 relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    value={ingSearch}
                    onChange={e => { setIngSearch(e.target.value); setSelectedProductId('') }}
                    placeholder="Buscar producto base..."
                    className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 w-full"
                  />
                  {filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                      {filteredProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => selectProduct(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                        >
                          <span className="font-medium text-[#0f172a]">{p.name}</span>
                          <span className="text-xs text-[#94a3b8]">
                            {p.cost_price !== null ? `${p.cost_price.toFixed(2)} €/${p.unit}` : 'sin coste'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  value={ingQty}
                  onChange={e => setIngQty(e.target.value)}
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="Cant."
                  className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 w-20"
                />
                <select
                  value={ingUnit}
                  onChange={e => setIngUnit(e.target.value)}
                  className="border border-[#e2e8f0] rounded-lg px-2 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400"
                >
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  onClick={addIngredient}
                  disabled={!selectedProductId}
                  className="px-3 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
                >
                  + Añadir
                </button>
              </div>
            </div>

            {/* Ingredient list */}
            <div className="flex flex-col gap-1">
              {ingredients.length === 0 && (
                <p className="text-sm text-[#94a3b8] py-2 text-center">Sin ingredientes</p>
              )}
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="flex-1 text-sm font-medium text-[#0f172a]">{ing.productName}</span>
                  <span className="text-xs text-[#64748b]">{ing.quantity} {ing.unit}</span>
                  <span className="text-xs text-[#94a3b8]">
                    = {(ing.costPrice * ing.quantity).toFixed(3)} €
                  </span>
                  <button
                    onClick={() => removeIngredient(idx)}
                    className="text-red-400 hover:text-red-600 text-sm font-bold ml-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || imageUploading}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plato'}
          </button>
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

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add components/carta/MenuItemFormPanel.tsx
git commit -m "feat: add MenuItemFormPanel with ingredient selector and live cost/margin"
```

---

## Task 7: CartaClient — tab de carta completo

**Files:**
- Crear: `app/productos/CartaClient.tsx`

- [ ] **Step 1: Crear `app/productos/CartaClient.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { MenuItem, Categoria, ProductoConCategoria } from '@/app/actions/productos'
import { getMenuItems } from '@/app/actions/productos'
import MenuItemCard from '@/components/carta/MenuItemCard'
import MenuItemFormPanel from '@/components/carta/MenuItemFormPanel'

interface Props {
  initialMenuItems: MenuItem[]
  categories: Categoria[]
  allProducts: ProductoConCategoria[]
  onProductsRefresh: () => void
}

export default function CartaClient({ initialMenuItems, categories, allProducts, onProductsRefresh }: Props) {
  const [menuItems, setMenuItems] = useState(initialMenuItems)
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [showPanel, setShowPanel] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getMenuItems()
      setMenuItems(fresh)
    })
  }

  function handleEdit(item: MenuItem) {
    setEditItem(item)
    setShowPanel(true)
  }

  function handleNewItem() {
    setEditItem(undefined)
    setShowPanel(true)
  }

  function handlePanelClose() {
    setShowPanel(false)
    setEditItem(undefined)
  }

  function handlePanelSaved() {
    handleRefresh()
  }

  const visible = menuItems.filter(item =>
    !filterCategoryId || item.category_id === filterCategoryId
  )

  // Categories that have at least one menu item
  const usedCategoryIds = new Set(menuItems.map(m => m.category_id).filter(Boolean))
  const visibleCategories = categories.filter(c => usedCategoryIds.has(c.id))

  return (
    <div className={isPending ? 'opacity-70 pointer-events-none' : ''}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="px-3 py-2 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 disabled:opacity-50"
        >
          {isPending ? 'Actualizando...' : 'Actualizar'}
        </button>

        {/* Category filter pills */}
        {visibleCategories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterCategoryId('')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                !filterCategoryId
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-slate-50'
              }`}
            >
              Todos
            </button>
            {visibleCategories.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCategoryId(c.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  filterCategoryId === c.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-slate-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleNewItem}
          className="ml-auto px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          + Nuevo plato
        </button>
      </div>

      {/* Stats */}
      {menuItems.length > 0 && (
        <div className="flex gap-3 mb-4 text-sm text-[#64748b]">
          <span>{menuItems.length} platos</span>
          <span>·</span>
          <span>{menuItems.filter(m => m.is_active).length} activos</span>
        </div>
      )}

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8]">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-sm font-medium">
            {menuItems.length === 0 ? 'La carta está vacía' : 'Sin platos en esta categoría'}
          </p>
          {menuItems.length === 0 && (
            <button
              onClick={handleNewItem}
              className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              + Añadir primer plato
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {/* Form panel */}
      {showPanel && (
        <MenuItemFormPanel
          item={editItem}
          categories={categories}
          allProducts={allProducts}
          onClose={handlePanelClose}
          onSaved={handlePanelSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript completo**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add app/productos/CartaClient.tsx
git commit -m "feat: add CartaClient with grid, category filter and form panel integration"
```

---

## Task 8: Build final y verificación

**Files:** Ninguno nuevo.

- [ ] **Step 1: Lint**

```powershell
npm run lint 2>&1
```

Resultado esperado: 0 errores (warnings pre-existentes en archivos no tocados son aceptables).

- [ ] **Step 2: Build de producción**

```powershell
npm run build
```

Resultado esperado: `✓ Compiled successfully` con la ruta `/productos` presente.

- [ ] **Step 3: Commit final si hay fixes de lint**

```powershell
git add -A
git commit -m "fix: lint fixes post carta module"
```

Si no hay cambios, omitir.

- [ ] **Step 4: Push**

```powershell
git push origin master
```

---

## Self-Review

| Requisito del spec | Tarea |
|---|---|
| Tab "📦 Productos" funciona igual | Task 4 (tab system, contenido existente intacto) |
| Tab "🍽️ Carta" muestra listado | Task 7 (CartaClient) |
| Tarjeta con nombre, precio, coste, margen con color | Task 5 (MenuItemCard) |
| Ingredientes resumidos en tarjeta | Task 5 |
| Crear plato con selector de ingredientes | Task 6 (MenuItemFormPanel) |
| Búsqueda en tiempo real de ingredientes | Task 6 |
| Coste y margen calculados en tiempo real | Task 6 |
| Margen rojo <30%, ámbar 30-60%, verde >60% | Tasks 5 + 6 |
| Toggle activo/inactivo | Task 5 (handleToggleActive) |
| Filtro por categoría | Task 7 (CategoryFilter pills) |
| Upload de foto a bucket 'products' | Task 6 (handleImageUpload) |
| Soft delete de plato | Task 2 (deleteMenuItem) + Task 5 (handleDelete) |
| Campo `unit` en productos base | Tasks 2 + 3 |
| RLS en nuevas tablas | Task 1 (SQL) |
| No se rompe el TPV | Cambios en `products` son aditivos (`unit` tiene DEFAULT) |
| Sin errores TypeScript | Verificación en cada tarea |
