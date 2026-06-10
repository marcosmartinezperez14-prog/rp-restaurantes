# Aforo Online + Cantidad Mínima — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir regla de aforo online (bloquear reservas/carta para grupos grandes) y cantidad mínima por pedido en platos de carta.

**Architecture:** Dos features independientes. Feature 1: server action en `administracion.ts` + panel client `AforoOnlinePanel` + wrapper client `CartaGate` en área pública. Feature 2: nuevo campo `cantidad_minima` propagado desde `productos.ts` → `MenuItemFormPanel` → API routes → `MesaPage`.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, Tailwind CSS v4

---

## Archivos a crear/modificar

| Acción | Ruta |
|---|---|
| MODIFICAR | `app/actions/productos.ts` |
| MODIFICAR | `components/carta/MenuItemFormPanel.tsx` |
| MODIFICAR | `app/api/cliente/[slug]/carta/route.ts` |
| MODIFICAR | `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts` |
| MODIFICAR | `app/cliente/[slug]/mesa/[mesa_id]/page.tsx` |
| MODIFICAR | `app/actions/administracion.ts` |
| CREAR | `components/administracion/AforoOnlinePanel.tsx` |
| MODIFICAR | `app/dashboard/administracion/page.tsx` |
| MODIFICAR | `app/api/cliente/[slug]/route.ts` |
| CREAR | `components/cliente/CartaGate.tsx` |
| MODIFICAR | `app/cliente/[slug]/page.tsx` |
| MODIFICAR | `app/cliente/[slug]/reservas/page.tsx` |

---

## Task 1: Tipo `MenuItem` + server actions de productos

**Files:**
- Modify: `app/actions/productos.ts`

- [ ] **Step 1: Añadir `cantidad_minima` al tipo `MenuItem` y actualizar `getMenuItems`**

En `app/actions/productos.ts`, localizar el tipo `MenuItem` (línea ~78) y añadir el campo:

```typescript
export type MenuItem = {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
  cantidad_minima: number
  deleted_at: string | null
  created_at: string
  updated_at: string
  category?: { name: string }
  ingredients: MenuItemIngredient[]
}
```

En `getMenuItems()`, cambiar el select para incluir `cantidad_minima`:

```typescript
  const { data } = await supabase
    .from('menu_items')
    .select(`
      id, restaurant_id, category_id, name, description, price,
      image_url, is_active, cantidad_minima, deleted_at, created_at, updated_at,
      categories(name),
      menu_item_ingredients(
        id, menu_item_id, product_id, restaurant_id, quantity, unit,
        products(id, name, cost_price, unit)
      )
    `)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('name')
```

En el `.map()` de `getMenuItems`, añadir el campo mapeado justo después de `is_active`:

```typescript
    is_active: item.is_active,
    cantidad_minima: Number(item.cantidad_minima) || 1,
```

- [ ] **Step 2: Actualizar `createMenuItem` para aceptar y guardar `cantidadMinima`**

En los params de `createMenuItem`, añadir el parámetro:

```typescript
export async function createMenuItem(params: {
  name: string
  description?: string
  categoryId?: string
  price: number
  imageUrl?: string
  isActive: boolean
  cantidadMinima?: number
  ingredients: { productId: string; quantity: number; unit: string }[]
}): Promise<{ success: true } | { error: string }> {
```

En el `.insert()` de `createMenuItem`, añadir el campo:

```typescript
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
      cantidad_minima: params.cantidadMinima ?? 1,
    })
    .select('id')
    .single()
```

- [ ] **Step 3: Actualizar `updateMenuItem` para aceptar y guardar `cantidadMinima`**

En los params de `updateMenuItem`, añadir:

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
    cantidadMinima?: number
    ingredients?: { productId: string; quantity: number; unit: string }[]
  }
): Promise<{ error?: string }> {
```

En la construcción de `updateData`, añadir después de `if (params.isActive !== undefined)`:

```typescript
  if (params.cantidadMinima !== undefined) updateData.cantidad_minima = params.cantidadMinima
```

- [ ] **Step 4: Verificar lint**

```bash
npm run lint 2>&1 | grep "productos"
```

Esperado: sin errores nuevos en `app/actions/productos.ts`.

- [ ] **Step 5: Commit**

```bash
git add app/actions/productos.ts
git commit -m "feat: campo cantidad_minima en tipo MenuItem y actions de carta"
```

---

## Task 2: Formulario de edición de platos — campo cantidad mínima

**Files:**
- Modify: `components/carta/MenuItemFormPanel.tsx`

- [ ] **Step 1: Añadir estado `cantidadMinima`**

En `MenuItemFormPanel`, justo después de `const [isActive, setIsActive] = useState(...)`:

```typescript
  const [cantidadMinima, setCantidadMinima] = useState(item?.cantidad_minima ?? 1)
```

- [ ] **Step 2: Añadir el campo en el formulario**

En el JSX, localizar el bloque del checkbox "Disponible en carta" y añadir el campo nuevo ANTES de él:

```tsx
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Cantidad mínima por pedido</span>
              <input
                value={cantidadMinima}
                onChange={e => setCantidadMinima(Math.max(1, parseInt(e.target.value) || 1))}
                type="number"
                min="1"
                step="1"
                className={inputClass}
              />
            </div>
```

- [ ] **Step 3: Incluir `cantidadMinima` en el payload de guardado**

En `handleSave`, dentro del bloque `if (isEditing)`:

```typescript
        res = await updateMenuItem(item.id, {
          name,
          description: description || null,
          categoryId: categoryId || null,
          price: priceNum,
          imageUrl: imageUrl || null,
          isActive,
          cantidadMinima,
          ingredients: ingPayload,
        })
```

Y en el bloque `else` (crear):

```typescript
        res = await createMenuItem({
          name,
          description: description || undefined,
          categoryId: categoryId || undefined,
          price: priceNum,
          imageUrl: imageUrl || undefined,
          isActive,
          cantidadMinima,
          ingredients: ingPayload,
        })
```

- [ ] **Step 4: Verificar lint**

```bash
npm run lint 2>&1 | grep "MenuItemFormPanel"
```

Esperado: sin errores en el archivo.

- [ ] **Step 5: Commit**

```bash
git add components/carta/MenuItemFormPanel.tsx
git commit -m "feat: campo 'Cantidad mínima por pedido' en formulario de plato"
```

---

## Task 3: API pública carta — propagar `cantidad_minima`

**Files:**
- Modify: `app/api/cliente/[slug]/carta/route.ts`

- [ ] **Step 1: Añadir `cantidad_minima` al tipo `ItemCarta` y al select**

Reemplazar el contenido completo de `app/api/cliente/[slug]/carta/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ItemCarta = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  imagen_url: string | null
  cantidad_minima: number
}

export type CategoriaCarta = {
  id: string
  nombre: string
  items: ItemCarta[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data: restaurante } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!restaurante) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  const { data: categorias } = await supabaseAdmin
    .from('categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurante.id)
    .is('deleted_at', null)
    .order('position')

  const { data: items } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, image_url, category_id, cantidad_minima')
    .eq('restaurant_id', restaurante.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  const carta: CategoriaCarta[] = (categorias ?? []).map(cat => ({
    id: cat.id,
    nombre: cat.name,
    items: (items ?? [])
      .filter(item => item.category_id === cat.id)
      .map(item => ({
        id: item.id,
        nombre: item.name,
        descripcion: item.description ?? null,
        precio: Number(item.price),
        imagen_url: item.image_url ?? null,
        cantidad_minima: Number(item.cantidad_minima) || 1,
      })),
  })).filter(cat => cat.items.length > 0)

  const sinCategoria = (items ?? []).filter(item => !item.category_id)
  if (sinCategoria.length > 0) {
    carta.push({
      id: 'sin-categoria',
      nombre: 'Otros',
      items: sinCategoria.map(item => ({
        id: item.id,
        nombre: item.name,
        descripcion: item.description ?? null,
        precio: Number(item.price),
        imagen_url: item.image_url ?? null,
        cantidad_minima: Number(item.cantidad_minima) || 1,
      })),
    })
  }

  return NextResponse.json({ carta })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cliente/[slug]/carta/route.ts
git commit -m "feat: campo cantidad_minima en API pública de carta"
```

---

## Task 4: API mesa — propagar `cantidad_minima` en GET

**Files:**
- Modify: `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts`

- [ ] **Step 1: Añadir `cantidad_minima` al select de items en el GET**

En la función `GET` de `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts`, cambiar el select de `menu_items`:

```typescript
  const { data: items } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, image_url, category_id, cantidad_minima')
    .eq('restaurant_id', restaurante.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
```

En el mapeo de items dentro de la carta del GET, añadir `cantidad_minima`:

```typescript
  const carta = (categorias ?? []).map(cat => ({
    id: cat.id,
    nombre: cat.name,
    items: (items ?? [])
      .filter(item => item.category_id === cat.id)
      .map(item => ({
        id: item.id,
        nombre: item.name,
        descripcion: item.description ?? null,
        precio: Number(item.price),
        imagen_url: item.image_url ?? null,
        cantidad_minima: Number(item.cantidad_minima) || 1,
      })),
  })).filter(cat => cat.items.length > 0)
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/cliente/[slug]/mesa/[mesa_id]/route.ts"
git commit -m "feat: campo cantidad_minima en API de mesa"
```

---

## Task 5: MesaPage — lógica de cantidad mínima en carrito

**Files:**
- Modify: `app/cliente/[slug]/mesa/[mesa_id]/page.tsx`

- [ ] **Step 1: Actualizar el tipo del import y la función `añadir`**

El tipo `ItemCarrito` es `ItemCarta & { cantidad: number }`. Como `ItemCarta` ya tendrá `cantidad_minima` tras el Task 3, no hay cambio de tipo necesario. Solo actualizar la lógica.

Reemplazar la función `añadir`:

```typescript
  function añadir(item: ItemCarta) {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === item.id)
      if (existe) return prev.map(i => i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { ...item, cantidad: item.cantidad_minima }]
    })
  }
```

- [ ] **Step 2: Actualizar la función `quitar` para respetar el mínimo**

Reemplazar la función `quitar`:

```typescript
  function quitar(itemId: string) {
    setCarrito(prev => {
      const item = prev.find(i => i.id === itemId)
      if (!item) return prev
      if (item.cantidad <= item.cantidad_minima) return prev.filter(i => i.id !== itemId)
      return prev.map(i => i.id === itemId ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
  }
```

- [ ] **Step 3: Añadir validación defensiva en `handleEnviarPedido`**

En `handleEnviarPedido`, justo después de `setErrorEnvio(null)`:

```typescript
    const itemInvalido = carrito.find(i => i.cantidad < i.cantidad_minima)
    if (itemInvalido) {
      setErrorEnvio(`"${itemInvalido.nombre}" tiene un mínimo de ${itemInvalido.cantidad_minima} unidad${itemInvalido.cantidad_minima === 1 ? '' : 'es'} por pedido.`)
      return
    }
```

- [ ] **Step 4: Verificar lint**

```bash
npm run lint 2>&1 | grep "mesa_id"
```

Esperado: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add "app/cliente/[slug]/mesa/[mesa_id]/page.tsx"
git commit -m "feat: cantidad_minima aplicada en carrito de mesa (añadir/quitar/validar)"
```

---

## Task 6: Server actions de aforo online

**Files:**
- Modify: `app/actions/administracion.ts`

- [ ] **Step 1: Añadir `getAforoOnline` y `guardarAforoOnline` al final del archivo**

Añadir al final de `app/actions/administracion.ts`:

```typescript
export async function getAforoOnline(): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('restaurants')
    .select('max_online_comensales')
    .eq('id', restaurantId)
    .single()

  return data?.max_online_comensales ?? null
}

export async function guardarAforoOnline(max: number | null): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Restaurante no encontrado' }

  const value = (max !== null && max > 0) ? max : null

  const { error } = await supabase
    .from('restaurants')
    .update({ max_online_comensales: value })
    .eq('id', restaurantId)

  if (error) return { error: error.message }
  return { ok: true }
}
```

- [ ] **Step 2: Verificar lint**

```bash
npm run lint 2>&1 | grep "administracion"
```

Esperado: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add app/actions/administracion.ts
git commit -m "feat: getAforoOnline y guardarAforoOnline en actions de administración"
```

---

## Task 7: Panel AforoOnline (dashboard)

**Files:**
- Create: `components/administracion/AforoOnlinePanel.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/administracion/AforoOnlinePanel.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { guardarAforoOnline } from '@/app/actions/administracion'

export default function AforoOnlinePanel({ initialMax }: { initialMax: number | null }) {
  const [valor, setValor] = useState(initialMax?.toString() ?? '')
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGuardar() {
    setError(null)
    setGuardado(false)
    const trimmed = valor.trim()
    const max = trimmed === '' || trimmed === '0' ? null : parseInt(trimmed)
    if (max !== null && (isNaN(max) || max < 1)) {
      setError('El valor debe ser un número mayor que 0')
      return
    }
    startTransition(async () => {
      const res = await guardarAforoOnline(max)
      if (res.error) { setError(res.error); return }
      setGuardado(true)
    })
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">Regla de aforo online</h2>

      <p className="text-sm text-[var(--text-secondary)]">
        A partir de cuántos comensales el cliente debe llamar por teléfono en lugar de continuar online.
        Deja el campo vacío para no aplicar ningún límite.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-[var(--text-primary)]">A partir de</span>
        <input
          type="number"
          min={1}
          step={1}
          value={valor}
          onChange={e => { setValor(e.target.value); setGuardado(false) }}
          placeholder="Sin límite"
          className="w-28 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-[var(--text-primary)]">comensales, requerir llamada telefónica</span>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}
      {guardado && (
        <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">Configuración guardada correctamente.</p>
      )}

      <button
        onClick={handleGuardar}
        disabled={isPending}
        className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
      >
        {isPending ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/administracion/AforoOnlinePanel.tsx
git commit -m "feat: AforoOnlinePanel para configurar límite de comensales online"
```

---

## Task 8: Página de Administración — añadir AforoOnlinePanel

**Files:**
- Modify: `app/dashboard/administracion/page.tsx`

- [ ] **Step 1: Reemplazar el contenido de la página**

Reemplazar el contenido completo de `app/dashboard/administracion/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { getReservasConfig, getAforoOnline } from '@/app/actions/administracion'
import ReservasConfigPanel from '@/components/administracion/ReservasConfigPanel'
import AforoOnlinePanel from '@/components/administracion/AforoOnlinePanel'

export default async function AdministracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [config, maxOnline] = await Promise.all([
    getReservasConfig(),
    getAforoOnline(),
  ])

  return (
    <AppShell title="Administración">
      <div className="max-w-2xl mx-auto space-y-6">
        <ReservasConfigPanel initialConfig={config} />
        <AforoOnlinePanel initialMax={maxOnline} />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/administracion/page.tsx
git commit -m "feat: AforoOnlinePanel integrado en página de Administración"
```

---

## Task 9: API `/api/cliente/[slug]` — exponer `max_online_comensales`

**Files:**
- Modify: `app/api/cliente/[slug]/route.ts`

- [ ] **Step 1: Añadir `max_online_comensales` al select y respuesta**

Reemplazar el contenido completo de `app/api/cliente/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, slug, max_online_comensales')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ restaurante: data })
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/cliente/[slug]/route.ts"
git commit -m "feat: max_online_comensales en API pública de restaurante"
```

---

## Task 10: Componente CartaGate

**Files:**
- Create: `components/cliente/CartaGate.tsx`

- [ ] **Step 1: Crear el directorio y el componente**

Crear `components/cliente/CartaGate.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface Props {
  maxOnlineComensales: number | null
  children: React.ReactNode
}

export default function CartaGate({ maxOnlineComensales, children }: Props) {
  const [confirmado, setConfirmado] = useState(false)
  const [comensales, setComensales] = useState(1)

  if (maxOnlineComensales === null) return <>{children}</>

  if (confirmado && comensales < maxOnlineComensales) return <>{children}</>

  if (confirmado && comensales >= maxOnlineComensales) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-4">📞</div>
        <p className="text-gray-700 font-semibold text-base mb-2">
          Para grupos de {maxOnlineComensales} o más personas, contacta con nosotros por teléfono.
        </p>
        <button
          onClick={() => setConfirmado(false)}
          className="mt-4 text-sm text-blue-600 underline"
        >
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center">
      <h2 className="text-lg font-bold text-gray-900 mb-2">¿Cuántos sois?</h2>
      <p className="text-sm text-gray-500 mb-6">Indica el número de personas</p>
      <div className="flex items-center justify-center gap-6 mb-8">
        <button
          onClick={() => setComensales(p => Math.max(1, p - 1))}
          className="w-10 h-10 rounded-full border border-gray-300 text-gray-700 text-lg font-bold flex items-center justify-center hover:bg-gray-50"
        >
          −
        </button>
        <span className="text-3xl font-bold text-gray-900 min-w-[3rem] text-center">{comensales}</span>
        <button
          onClick={() => setComensales(p => p + 1)}
          className="w-10 h-10 rounded-full border border-gray-300 text-gray-700 text-lg font-bold flex items-center justify-center hover:bg-gray-50"
        >
          +
        </button>
      </div>
      <button
        onClick={() => setConfirmado(true)}
        className="w-full max-w-xs mx-auto py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
      >
        Continuar
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cliente/CartaGate.tsx
git commit -m "feat: CartaGate — stepper de comensales con regla de aforo online"
```

---

## Task 11: Página carta pública — gate de comensales

**Files:**
- Modify: `app/cliente/[slug]/page.tsx`

- [ ] **Step 1: Añadir `max_online_comensales` al select y envolver carta con CartaGate**

Reemplazar el contenido completo de `app/cliente/[slug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CategoriaCarta } from '@/app/api/cliente/[slug]/carta/route'
import CartaGate from '@/components/cliente/CartaGate'

export default async function ClienteCartaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: restaurante } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, slug, max_online_comensales')
    .eq('slug', slug)
    .single()

  if (!restaurante) notFound()

  const { data: categorias } = await supabaseAdmin
    .from('categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurante.id)
    .is('deleted_at', null)
    .order('position')

  const { data: items } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, image_url, category_id')
    .eq('restaurant_id', restaurante.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  const carta: CategoriaCarta[] = (categorias ?? []).map(cat => ({
    id: cat.id,
    nombre: cat.name,
    items: (items ?? [])
      .filter(i => i.category_id === cat.id)
      .map(i => ({
        id: i.id,
        nombre: i.name,
        descripcion: i.description ?? null,
        precio: Number(i.price),
        imagen_url: i.image_url ?? null,
        cantidad_minima: 1,
      })),
  })).filter(cat => cat.items.length > 0)

  const sinCategoria = (items ?? []).filter(i => !i.category_id)
  if (sinCategoria.length > 0) {
    carta.push({
      id: 'sin-categoria',
      nombre: 'Otros',
      items: sinCategoria.map(i => ({
        id: i.id,
        nombre: i.name,
        descripcion: i.description ?? null,
        precio: Number(i.price),
        imagen_url: i.image_url ?? null,
        cantidad_minima: 1,
      })),
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{restaurante.name}</h1>
      </div>

      <CartaGate maxOnlineComensales={restaurante.max_online_comensales ?? null}>
        <div className="mb-8">
          <Link
            href={`/cliente/${slug}/reservas`}
            className="block w-full py-3 bg-blue-600 text-white text-center font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Reservar mesa
          </Link>
        </div>

        {carta.length === 0 ? (
          <p className="text-center text-gray-500 py-12">La carta no está disponible en este momento.</p>
        ) : (
          <div className="space-y-8">
            {carta.map(categoria => (
              <section key={categoria.id}>
                <h2 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b border-gray-200">
                  {categoria.nombre}
                </h2>
                <div className="space-y-3">
                  {categoria.items.map(item => (
                    <div key={item.id} className="flex gap-3 py-3">
                      {item.imagen_url && (
                        <img
                          src={item.imagen_url}
                          alt={item.nombre}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900 text-sm">{item.nombre}</p>
                          <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                            {item.precio.toFixed(2)} €
                          </p>
                        </div>
                        {item.descripcion && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </CartaGate>
    </div>
  )
}
```

- [ ] **Step 2: Verificar lint**

```bash
npm run lint 2>&1 | grep "cliente/\[slug\]/page"
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/cliente/[slug]/page.tsx"
git commit -m "feat: CartaGate en carta pública — stepper de comensales con regla de aforo"
```

---

## Task 12: Reservas públicas — validación de aforo

**Files:**
- Modify: `app/cliente/[slug]/reservas/page.tsx`

- [ ] **Step 1: Añadir fetch de `max_online_comensales` y estado**

En `app/cliente/[slug]/reservas/page.tsx`, añadir import de `useEffect` si no está:

```typescript
import { useState, useEffect } from 'react'
```

Añadir estado tras los estados existentes:

```typescript
  const [maxOnlineComensales, setMaxOnlineComensales] = useState<number | null>(null)
```

Añadir `useEffect` para cargar el límite (justo antes o después del `const hoy = ...`):

```typescript
  useEffect(() => {
    fetch(`/api/cliente/${slug}`)
      .then(r => r.json())
      .then(data => {
        const max = data.restaurante?.max_online_comensales
        if (typeof max === 'number') setMaxOnlineComensales(max)
      })
      .catch(() => {})
  }, [slug])
```

- [ ] **Step 2: Añadir validación en `handleEnviar`**

En `handleEnviar`, añadir la validación justo después de `if (numPersonas < 1) ...`:

```typescript
    if (maxOnlineComensales !== null && numPersonas >= maxOnlineComensales) {
      setError(`Para grupos de ${maxOnlineComensales} o más personas, contacta con nosotros por teléfono.`)
      return
    }
```

- [ ] **Step 3: Verificar lint**

```bash
npm run lint 2>&1 | grep "reservas/page"
```

Esperado: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add "app/cliente/[slug]/reservas/page.tsx"
git commit -m "feat: validación de aforo online en formulario de reservas"
```

---

## Task 13: Build final + push

- [ ] **Step 1: Lint completo**

```bash
npm run lint 2>&1 | grep "error" | grep -v "node_modules"
```

Verificar que no hay errores nuevos introducidos por este trabajo. Los errores pre-existentes en `TicketPreview.tsx`, `EquipoClient.tsx` y otros archivos no relacionados pueden ignorarse.

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `Route (app)` table sin errores. Build exitoso.

- [ ] **Step 3: Push**

```bash
git push origin master
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1-2: `cantidad_minima` en tipo + form del dashboard
- ✅ Task 3-4: `cantidad_minima` propagada por ambas APIs públicas de carta
- ✅ Task 5: lógica en MesaPage (añadir con mínimo, quitar con umbral, validación en envío)
- ✅ Task 6: `getAforoOnline` + `guardarAforoOnline` en actions
- ✅ Task 7-8: `AforoOnlinePanel` integrado en `/dashboard/administracion`
- ✅ Task 9: `max_online_comensales` en API pública de restaurante
- ✅ Task 10-11: `CartaGate` con stepper en carta pública
- ✅ Task 12: validación en formulario de reservas
- ✅ Sin nuevas tablas SQL
- ✅ Todo el texto en español
- ✅ Sin etiquetas `<label>` en nuevos componentes standalone
