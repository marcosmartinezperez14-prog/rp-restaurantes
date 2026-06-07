# Área Pública de Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un área pública sin autenticación en `/cliente/[slug]` con carta del restaurante, formulario de reserva y pedido desde QR de mesa que aparece en el TPV y cocina.

**Architecture:** API routes con service role key (bypass RLS) para leer y escribir datos públicos. Server Component para la carta principal. Client Components para formulario de reserva y carrito QR. Layout independiente del dashboard.

**Tech Stack:** Next.js App Router, Supabase (service role), TypeScript, Tailwind CSS

---

## Archivos a crear/modificar

| Acción | Ruta |
|---|---|
| CREAR | `lib/supabase/admin.ts` |
| CREAR | `app/api/cliente/[slug]/route.ts` |
| CREAR | `app/api/cliente/[slug]/carta/route.ts` |
| CREAR | `app/api/cliente/[slug]/reservas/route.ts` |
| CREAR | `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts` |
| CREAR | `app/cliente/[slug]/layout.tsx` |
| CREAR | `app/cliente/[slug]/page.tsx` |
| CREAR | `app/cliente/[slug]/reservas/page.tsx` |
| CREAR | `app/cliente/[slug]/mesa/[mesa_id]/page.tsx` |
| CREAR | `SQL_CLIENTE_SLUG.md` |

---

## Task 1: SQL — añadir slug a restaurants

**Files:**
- Create: `SQL_CLIENTE_SLUG.md`

- [ ] **Step 1: Crear el archivo SQL de referencia**

Crear `SQL_CLIENTE_SLUG.md` con el contenido:

```markdown
# SQL — Slug en restaurants

Ejecuta en el SQL Editor de Supabase:

```sql
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

UPDATE restaurants
  SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
  WHERE slug IS NULL;
```
```

- [ ] **Step 2: Ejecutar el SQL en Supabase**

Ir a Supabase Dashboard → SQL Editor y ejecutar el SQL del archivo anterior.
Verificar: `SELECT id, name, slug FROM restaurants LIMIT 5;` debe devolver filas con slug no nulo.

- [ ] **Step 3: Commit**

```bash
git add SQL_CLIENTE_SLUG.md
git commit -m "docs: SQL para añadir slug a restaurants"
```

---

## Task 2: Cliente admin de Supabase (service role)

**Files:**
- Create: `lib/supabase/admin.ts`

- [ ] **Step 1: Crear el cliente admin**

Crear `lib/supabase/admin.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

- [ ] **Step 2: Verificar que la variable de entorno existe**

```bash
grep SUPABASE_SERVICE_ROLE_KEY .env.local
```

Debe aparecer la clave. Si no existe, añadirla al `.env.local` desde el dashboard de Supabase → Settings → API → service_role key.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/admin.ts
git commit -m "feat: cliente Supabase con service role para área pública"
```

---

## Task 3: API — información del restaurante por slug

**Files:**
- Create: `app/api/cliente/[slug]/route.ts`

- [ ] **Step 1: Crear la route**

Crear `app/api/cliente/[slug]/route.ts`:

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
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ restaurante: data })
}
```

- [ ] **Step 2: Verificar manualmente**

Con el servidor corriendo (`npm run dev`), abrir en el navegador:
`http://localhost:3000/api/cliente/[slug-del-restaurante]`

Reemplazar `[slug-del-restaurante]` con el slug generado en el SQL (ej: `mi-restaurante`).
Debe devolver JSON con `id`, `name`, `slug`.

- [ ] **Step 3: Commit**

```bash
git add app/api/cliente/
git commit -m "feat: API GET restaurante público por slug"
```

---

## Task 4: API — carta pública (menu_items por categoría)

**Files:**
- Create: `app/api/cliente/[slug]/carta/route.ts`

- [ ] **Step 1: Crear la route**

Crear `app/api/cliente/[slug]/carta/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ItemCarta = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  imagen_url: string | null
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
    .select('id, name, description, price, image_url, category_id')
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
      })),
  })).filter(cat => cat.items.length > 0)

  // Items sin categoría al final
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
      })),
    })
  }

  return NextResponse.json({ carta })
}
```

- [ ] **Step 2: Verificar manualmente**

`http://localhost:3000/api/cliente/[slug]/carta`

Debe devolver `{ carta: [...] }` con categorías y platos. Si el restaurante no tiene `menu_items` aún, el array estará vacío — eso es correcto.

- [ ] **Step 3: Commit**

```bash
git add app/api/cliente/
git commit -m "feat: API GET carta pública por slug"
```

---

## Task 5: API — crear reserva pública

**Files:**
- Create: `app/api/cliente/[slug]/reservas/route.ts`

- [ ] **Step 1: Crear la route**

Crear `app/api/cliente/[slug]/reservas/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await req.json()
    const { nombre_cliente, telefono, fecha, hora, num_personas, notas } = body

    if (!nombre_cliente?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    if (!telefono?.trim()) return NextResponse.json({ error: 'El teléfono es obligatorio' }, { status: 400 })
    if (!fecha) return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 })
    if (!hora) return NextResponse.json({ error: 'La hora es obligatoria' }, { status: 400 })
    if (!num_personas || num_personas < 1) return NextResponse.json({ error: 'El número de personas debe ser al menos 1' }, { status: 400 })

    const { data: restaurante } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        restaurant_id: restaurante.id,
        customer_name: nombre_cliente.trim(),
        customer_phone: telefono.trim(),
        customer_email: null,
        party_size: Number(num_personas),
        reservation_date: fecha,
        reservation_time: hora,
        status: 'confirmed',
        notes: notas?.trim() || null,
      })
      .select('id')
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message ?? 'No se pudo crear la reserva' }, { status: 500 })

    return NextResponse.json({ ok: true, id: data.id })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar manualmente con curl o Thunder Client**

```bash
curl -X POST http://localhost:3000/api/cliente/[slug]/reservas \
  -H "Content-Type: application/json" \
  -d '{"nombre_cliente":"Test","telefono":"600000000","fecha":"2026-07-01","hora":"20:00","num_personas":2}'
```

Debe devolver `{ ok: true, id: "..." }`. Verificar en Supabase que aparece en la tabla `reservations`.

- [ ] **Step 3: Commit**

```bash
git add app/api/cliente/
git commit -m "feat: API POST reserva pública (inserta en reservations existente)"
```

---

## Task 6: API — mesa info y crear pedido QR

**Files:**
- Create: `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts`

- [ ] **Step 1: Crear la route**

Crear `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ItemPedido = {
  menu_item_id: string
  nombre: string
  precio: number
  cantidad: number
}

async function getRestauranteBySlug(slug: string) {
  const { data } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .single()
  return data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; mesa_id: string }> }
) {
  const { slug, mesa_id } = await params

  const restaurante = await getRestauranteBySlug(slug)
  if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

  const { data: mesa } = await supabaseAdmin
    .from('tables')
    .select('id, name, capacity')
    .eq('id', mesa_id)
    .eq('restaurant_id', restaurante.id)
    .maybeSingle()

  if (!mesa) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })

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
      })),
  })).filter(cat => cat.items.length > 0)

  return NextResponse.json({ mesa: { id: mesa.id, nombre: mesa.name }, carta })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; mesa_id: string }> }
) {
  try {
    const { slug, mesa_id } = await params
    const body = await req.json()
    const items: ItemPedido[] = body.items ?? []

    if (!items.length) return NextResponse.json({ error: 'El pedido está vacío' }, { status: 400 })

    const restaurante = await getRestauranteBySlug(slug)
    if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

    const { data: mesa } = await supabaseAdmin
      .from('tables')
      .select('id')
      .eq('id', mesa_id)
      .eq('restaurant_id', restaurante.id)
      .maybeSingle()

    if (!mesa) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })

    // Buscar order abierta para la mesa
    let orderId: string

    const { data: orderAbierta } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('table_id', mesa_id)
      .eq('restaurant_id', restaurante.id)
      .eq('status', 'open')
      .is('deleted_at', null)
      .maybeSingle()

    if (orderAbierta) {
      orderId = orderAbierta.id
    } else {
      // Crear nueva order
      const { data: orderNumber } = await supabaseAdmin
        .rpc('get_next_order_number', { p_restaurant_id: restaurante.id })

      const today = new Date().toISOString().split('T')[0]
      const { data: nuevaOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          restaurant_id: restaurante.id,
          table_id: mesa_id,
          status: 'open',
          type: 'dine_in',
          order_number: orderNumber,
          opened_at: new Date().toISOString(),
          order_date: today,
        })
        .select('id')
        .single()

      if (orderError || !nuevaOrder) {
        return NextResponse.json({ error: 'No se pudo crear la comanda' }, { status: 500 })
      }
      orderId = nuevaOrder.id

      // Marcar mesa como ocupada
      await supabaseAdmin
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', mesa_id)
    }

    // Insertar items
    const orderItemsData = items.map(item => ({
      restaurant_id: restaurante.id,
      order_id: orderId,
      product_id: item.menu_item_id,
      product_name: item.nombre,
      product_price: item.precio,
      tax_rate: 0,
      quantity: item.cantidad,
      unit_price: item.precio,
      total_price: item.precio * item.cantidad,
      modifiers: [],
      notes: null,
      status: 'pending',
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, order_id: orderId })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar GET manualmente**

`http://localhost:3000/api/cliente/[slug]/mesa/[mesa_id]`

Usar un `mesa_id` UUID real de la tabla `tables`. Debe devolver `{ mesa: {...}, carta: [...] }`.

- [ ] **Step 3: Commit**

```bash
git add app/api/cliente/
git commit -m "feat: API GET+POST mesa pública — info y pedido QR hacia TPV"
```

---

## Task 7: Layout público del área cliente

**Files:**
- Create: `app/cliente/[slug]/layout.tsx`

- [ ] **Step 1: Crear el layout**

Crear `app/cliente/[slug]/layout.tsx`:

```typescript
export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        {children}
      </main>
      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-100">
        Powered by RP Restaurantes
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que no rompe el layout raíz**

Navegar a `http://localhost:3000/cliente/[slug]` (aunque la page aún no exista, Next.js mostrará un 404 sin errores de layout).

- [ ] **Step 3: Commit**

```bash
git add app/cliente/
git commit -m "feat: layout público del área cliente (independiente del dashboard)"
```

---

## Task 8: Página carta pública (Server Component)

**Files:**
- Create: `app/cliente/[slug]/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/cliente/[slug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CategoriaCarta } from '@/app/api/cliente/[slug]/carta/route'

export default async function ClienteCartaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: restaurante } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, slug')
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
      })),
  })).filter(cat => cat.items.length > 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Cabecera restaurante */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{restaurante.name}</h1>
      </div>

      {/* Botón reservar */}
      <div className="mb-8">
        <Link
          href={`/cliente/${slug}/reservas`}
          className="block w-full py-3 bg-blue-600 text-white text-center font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Reservar mesa
        </Link>
      </div>

      {/* Carta por categorías */}
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
    </div>
  )
}
```

- [ ] **Step 2: Verificar en el navegador**

`http://localhost:3000/cliente/[slug]`

Debe mostrar: nombre del restaurante, botón "Reservar mesa", carta organizada por categorías. Si no hay `menu_items`, mostrar el mensaje vacío.

Verificar también que `http://localhost:3000/cliente/slug-inexistente` devuelve la página 404 de Next.js.

- [ ] **Step 3: Commit**

```bash
git add app/cliente/
git commit -m "feat: página carta pública del restaurante por slug"
```

---

## Task 9: Página formulario de reserva (Client Component)

**Files:**
- Create: `app/cliente/[slug]/reservas/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/cliente/[slug]/reservas/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function ReservasPage() {
  const params = useParams()
  const slug = params.slug as string

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [numPersonas, setNumPersonas] = useState(2)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const hoy = new Date().toISOString().split('T')[0]

  async function handleEnviar() {
    setError(null)
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!telefono.trim()) { setError('El teléfono es obligatorio'); return }
    if (!fecha) { setError('La fecha es obligatoria'); return }
    if (!hora) { setError('La hora es obligatoria'); return }
    if (numPersonas < 1) { setError('El número de personas debe ser al menos 1'); return }

    setEnviando(true)
    try {
      const res = await fetch(`/api/cliente/${slug}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_cliente: nombre,
          telefono,
          fecha,
          hora,
          num_personas: numPersonas,
          notas: notas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo realizar la reserva'); return }
      setEnviado(true)
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Reserva recibida!</h2>
        <p className="text-gray-500 text-sm">
          Te esperamos el {fecha.split('-').reverse().join('/')} a las {hora}h.<br />
          Nos pondremos en contacto si necesitamos confirmar.
        </p>
        <a
          href={`/cliente/${slug}`}
          className="inline-block mt-6 px-4 py-2 text-sm text-blue-600 underline"
        >
          Ver la carta
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/cliente/${slug}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          ←
        </a>
        <h1 className="text-xl font-bold text-gray-900">Reservar mesa</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre completo"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            type="tel"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="600 000 000"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              min={hoy}
              onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de personas</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setNumPersonas(p => Math.max(1, p - 1))}
              className="w-10 h-10 rounded-full border border-gray-300 text-gray-700 text-lg font-bold flex items-center justify-center hover:bg-gray-50"
            >
              −
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[2rem] text-center">
              {numPersonas}
            </span>
            <button
              onClick={() => setNumPersonas(p => p + 1)}
              className="w-10 h-10 rounded-full border border-gray-300 text-gray-700 text-lg font-bold flex items-center justify-center hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Alergias, cumpleaños, preferencias..."
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleEnviar}
          disabled={enviando}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {enviando ? 'Enviando...' : 'Confirmar reserva'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar en el navegador**

`http://localhost:3000/cliente/[slug]/reservas`

Rellenar el formulario y enviar. Verificar en Supabase → tabla `reservations` que aparece la fila. La pantalla debe cambiar a la confirmación.

Verificar también los errores: enviar sin nombre → mensaje de error visible.

- [ ] **Step 3: Commit**

```bash
git add app/cliente/
git commit -m "feat: formulario de reserva pública del cliente"
```

---

## Task 10: Página pedido QR de mesa (Client Component)

**Files:**
- Create: `app/cliente/[slug]/mesa/[mesa_id]/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/cliente/[slug]/mesa/[mesa_id]/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { CategoriaCarta, ItemCarta } from '@/app/api/cliente/[slug]/carta/route'

type ItemCarrito = ItemCarta & { cantidad: number }

export default function MesaPage() {
  const params = useParams()
  const slug = params.slug as string
  const mesaId = params.mesa_id as string

  const [mesa, setMesa] = useState<{ id: string; nombre: string } | null>(null)
  const [carta, setCarta] = useState<CategoriaCarta[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/cliente/${slug}/mesa/${mesaId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setMesa(data.mesa)
        setCarta(data.carta)
      })
      .catch(() => setError('No se pudo cargar la carta'))
      .finally(() => setCargando(false))
  }, [slug, mesaId])

  function añadir(item: ItemCarta) {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === item.id)
      if (existe) return prev.map(i => i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { ...item, cantidad: 1 }]
    })
  }

  function quitar(itemId: string) {
    setCarrito(prev => {
      const item = prev.find(i => i.id === itemId)
      if (!item) return prev
      if (item.cantidad === 1) return prev.filter(i => i.id !== itemId)
      return prev.map(i => i.id === itemId ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
  }

  function cantidadEnCarrito(itemId: string): number {
    return carrito.find(i => i.id === itemId)?.cantidad ?? 0
  }

  const totalCarrito = carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0)
  const totalItems = carrito.reduce((sum, i) => sum + i.cantidad, 0)

  async function handleEnviarPedido() {
    setErrorEnvio(null)
    setEnviando(true)
    try {
      const res = await fetch(`/api/cliente/${slug}/mesa/${mesaId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: carrito.map(i => ({
            menu_item_id: i.id,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorEnvio(data.error ?? 'No se pudo enviar el pedido'); return }
      setPedidoEnviado(true)
      setCarrito([])
    } catch {
      setErrorEnvio('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm">Cargando carta...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <p className="text-red-500 text-sm text-center">{error}</p>
      </div>
    )
  }

  if (pedidoEnviado) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">🍽️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Pedido enviado!</h2>
        <p className="text-gray-500 text-sm">El equipo ya está preparando tu pedido.</p>
        <button
          onClick={() => setPedidoEnviado(false)}
          className="inline-block mt-6 px-4 py-2 text-sm text-blue-600 underline"
        >
          Pedir más
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-36">
      {/* Cabecera */}
      <div className="text-center mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Mesa</p>
        <h1 className="text-2xl font-bold text-gray-900">{mesa?.nombre}</h1>
      </div>

      {/* Carta */}
      {carta.length === 0 ? (
        <p className="text-center text-gray-500 py-12">La carta no está disponible.</p>
      ) : (
        <div className="space-y-8">
          {carta.map(categoria => (
            <section key={categoria.id}>
              <h2 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b border-gray-200">
                {categoria.nombre}
              </h2>
              <div className="space-y-2">
                {categoria.items.map(item => {
                  const cantidad = cantidadEnCarrito(item.id)
                  return (
                    <div key={item.id} className="flex gap-3 py-3">
                      {item.imagen_url && (
                        <img
                          src={item.imagen_url}
                          alt={item.nombre}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
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
                        <div className="flex items-center gap-3 mt-2">
                          {cantidad > 0 ? (
                            <>
                              <button
                                onClick={() => quitar(item.id)}
                                className="w-7 h-7 rounded-full border border-gray-300 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-50 text-sm"
                              >
                                −
                              </button>
                              <span className="text-sm font-semibold text-gray-900 min-w-[1rem] text-center">
                                {cantidad}
                              </span>
                            </>
                          ) : null}
                          <button
                            onClick={() => añadir(item)}
                            className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center hover:bg-blue-700 text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Carrito flotante */}
      {carrito.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
          {errorEnvio && (
            <p className="text-xs text-red-600 mb-2 text-center">{errorEnvio}</p>
          )}
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">{totalItems} {totalItems === 1 ? 'plato' : 'platos'}</p>
              <p className="text-lg font-bold text-gray-900">{totalCarrito.toFixed(2)} €</p>
            </div>
            <button
              onClick={handleEnviarPedido}
              disabled={enviando}
              className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {enviando ? 'Enviando...' : 'Enviar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar en el navegador**

`http://localhost:3000/cliente/[slug]/mesa/[mesa_id-real]`

Usar un UUID real de la tabla `tables`. Debe:
1. Mostrar el nombre de la mesa y la carta
2. Permitir añadir/quitar platos, el carrito flotante aparece
3. Al pulsar "Enviar pedido" → aparece confirmación
4. Verificar en Supabase: tabla `orders` tiene la fila, tabla `order_items` tiene los platos con `status: 'pending'`, tabla `tables` tiene `status: 'occupied'`
5. Verificar en el TPV del dashboard que la mesa aparece como ocupada con la comanda

- [ ] **Step 3: Commit final**

```bash
git add app/cliente/
git commit -m "feat: página QR de mesa — carta + carrito + pedido directo al TPV"
```

---

## Self-Review

**Spec coverage:**
- ✅ Rutas: `/cliente/[slug]`, `/cliente/[slug]/reservas`, `/cliente/[slug]/mesa/[mesa_id]`
- ✅ Layout independiente sin navbar del dashboard
- ✅ Protección: sin middleware, rutas /cliente son públicas por ausencia de redirect('/login')
- ✅ SQL: slug en `restaurants`
- ✅ API GET restaurante por slug
- ✅ API GET carta pública (menu_items activos por categoría)
- ✅ API POST reserva → tabla `reservations` existente
- ✅ API GET mesa + carta
- ✅ API POST pedido QR → `orders` + `order_items` (status: pending, aparece en TPV y cocina)
- ✅ Carta: nombre, descripción, precio, imagen
- ✅ Reservas: nombre, teléfono, fecha, hora, num_personas, notas, confirmación en pantalla
- ✅ QR: carrito local, carrito flotante, confirmación tras envío
- ✅ UI en español, mobile-first, sin `<form>`, sin enlaces al dashboard
- ✅ Service role key en todas las API routes del área cliente
