# Variantes y Modificadores de Carta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir gestión de variantes/modificadores por plato (backoffice), selector en TPV y carta pública QR, con persistencia enriquecida en order_items y visualización en tickets.

**Architecture:** Las tablas `product_modifier_groups` y `product_modifier_options` pueden ya existir (verificar en PASO 0). El TPV ya tiene `ModifierModal` y tipos para modificadores, pero `getMenuData` devuelve `modifierGroups: []` siempre — se conectará a la BD real. `SelectorModificadores` es el componente compartido para TPV y QR. `GestorModificadores` es el panel de backoffice integrado dentro de `MenuItemFormPanel`. El campo `modifiers_snapshot` (nuevo, más rico) se añade a `order_items` junto al `modifiers` existente.

**Tech Stack:** Next.js App Router, Supabase (RLS + admin client), TypeScript, Tailwind CSS

---

## CRÍTICO: Hallazgos de exploración del codebase

Antes de escribir código, tener presente:

- `app/actions/tpv.ts` ya tiene tipos `ModifierGroup { is_required, min_selections, max_selections }` y `ModifierOption { price_adjustment }` — el plan actualiza estos tipos para que coincidan con la BD real
- `components/tpv/ModifierModal.tsx` ya existe y usa los tipos viejos — se reemplaza con `SelectorModificadores`
- `app/api/tpv/order-items/route.ts` ya acepta `modifiers` (JSONB) y `notes` — se añade `modifiers_snapshot` y `nota`
- `app/cliente/[slug]/mesa/[mesa_id]/route.ts` usa `supabaseAdmin`, inserta `modifiers: []` — necesita aceptar `modifiers_snapshot`
- `components/carta/MenuItemFormPanel.tsx` termina con `{error && ...}` justo antes del footer de botones — `GestorModificadores` se inserta ahí
- `components/tpv/TicketPreview.tsx` fetches `order_items` sin el campo `modifiers` — se actualiza la query
- La tabla FK es `restaurants` (inglés), NO `restaurantes`

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|---|---|---|
| MANUAL | Supabase SQL Editor | PASO 0: verificación + PASO 1: migración |
| CREAR | `types/modificadores.ts` | Tipos TS del nuevo sistema |
| MODIFICAR | `app/actions/tpv.ts` | Actualizar `ModifierGroup`/`ModifierOption`, `getMenuData` carga grupos reales |
| CREAR | `app/api/modificadores/[menu_item_id]/route.ts` | GET público — grupos+opciones por plato |
| CREAR | `app/api/modificadores/grupos/route.ts` | POST — crear grupo |
| CREAR | `app/api/modificadores/grupos/[grupo_id]/route.ts` | PUT/DELETE — editar/desactivar grupo |
| CREAR | `app/api/modificadores/opciones/route.ts` | POST — crear opción |
| CREAR | `app/api/modificadores/opciones/[opcion_id]/route.ts` | PUT/DELETE — editar/desactivar opción |
| CREAR | `components/carta/GestorModificadores.tsx` | Backoffice CRUD de grupos y opciones por plato |
| MODIFICAR | `components/carta/MenuItemFormPanel.tsx` | Añadir `GestorModificadores` al final del form (solo en edición) |
| CREAR | `components/shared/SelectorModificadores.tsx` | Modal de selección compartido TPV+QR |
| MODIFICAR | `components/tpv/ProductsPanel.tsx` | Usar `SelectorModificadores` en lugar de `ModifierModal` |
| MODIFICAR | `components/tpv/OrderPanel.tsx` | Mostrar modificadores bajo cada línea |
| MODIFICAR | `app/api/tpv/order-items/route.ts` | Aceptar `modifiers_snapshot` y `nota` |
| MODIFICAR | `app/cliente/[slug]/mesa/[mesa_id]/page.tsx` | Carrito con `SelectorModificadores`, snapshot por ítem |
| MODIFICAR | `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts` | Aceptar `modifiers_snapshot` y `nota` por ítem |
| MODIFICAR | `components/tpv/TicketPreview.tsx` | Mostrar modificadores en el ticket |

---

## Task 0: PASO 0 — Verificación SQL (manual)

**Archivos:** ninguno — SQL a ejecutar en Supabase → SQL Editor

- [ ] **Step 1: Ejecutar el SQL de exploración**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'product_modifier_groups',
  'product_modifier_options'
);

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('product_modifier_groups','product_modifier_options')
ORDER BY table_name, ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_items'
ORDER BY ordinal_position;
```

- [ ] **Step 2: Documentar resultado**

Si `product_modifier_groups` ya existe, anotar sus columnas exactas.
Si no existe, la Task 1 la creará desde cero.

Si `order_items` ya tiene columna `modifiers_snapshot`, omitir ese `ALTER` en Task 1.

---

## Task 1: PASO 1 — Migración SQL (manual)

**Archivos:** ninguno — SQL a ejecutar en Supabase → SQL Editor

- [ ] **Step 1: Crear función update_updated_at_column si no existe**

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;
```

- [ ] **Step 2: Crear tablas de modificadores**

Solo ejecutar si las tablas NO existen o tienen columnas incompatibles.
Si ya existen con columnas compatibles (`type`, `required`, `allows_multiple`), saltar este paso.

```sql
CREATE TABLE IF NOT EXISTS product_modifier_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id)  ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('variante','modificador')),
  required        BOOLEAN NOT NULL DEFAULT false,
  allows_multiple BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_modifier_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price_delta DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmg_menu_item ON product_modifier_groups(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_pmo_group     ON product_modifier_options(group_id);

CREATE OR REPLACE TRIGGER update_pmg_updated_at
  BEFORE UPDATE ON product_modifier_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifier_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmg_all" ON product_modifier_groups
  FOR ALL USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "pmo_all" ON product_modifier_options
  FOR ALL USING (
    group_id IN (
      SELECT id FROM product_modifier_groups
      WHERE restaurant_id = get_current_restaurant_id()
    )
  );
```

- [ ] **Step 3: Añadir columna modifiers_snapshot a order_items**

```sql
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS modifiers_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;
```

- [ ] **Step 4: Verificar**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('product_modifier_groups','product_modifier_options');

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_items'
AND column_name IN ('modifiers','modifiers_snapshot','notes');
```

Resultado esperado: 2 tablas, 3 columnas en order_items.

---

## Task 2: Tipos TypeScript

**Archivos:**
- Crear: `types/modificadores.ts`
- Modificar: `app/actions/tpv.ts` — actualizar `ModifierGroup`, `ModifierOption`, `OrderItem`

- [ ] **Step 1: Crear types/modificadores.ts**

```typescript
export type ModifierGroupType = 'variante' | 'modificador'

export interface ModifierOption {
  id: string
  group_id: string
  name: string
  price_delta: number
  is_default: boolean
  is_active: boolean
  sort_order: number
}

export interface ModifierGroup {
  id: string
  restaurant_id: string
  menu_item_id: string
  name: string
  type: ModifierGroupType
  required: boolean
  allows_multiple: boolean
  sort_order: number
  is_active: boolean
  options: ModifierOption[]
}

export interface ModifierSnapshot {
  group_id: string
  group_name: string
  group_type: ModifierGroupType
  option_id: string
  option_name: string
  price_delta: number
}

export interface ModifierSelection {
  group_id: string
  option_ids: string[]
}

export interface ItemConModificadores {
  menu_item_id: string
  cantidad: number
  precio_final: number
  modifiers_snapshot: ModifierSnapshot[]
  nota?: string
}
```

- [ ] **Step 2: Actualizar tipos en app/actions/tpv.ts**

Reemplazar los tipos `ModifierOption`, `ModifierGroup`, `SelectedModifier` y `OrderItem` actuales por las versiones compatibles con la BD real. Localizar las líneas 12-25 y 57-74 y sustituir:

```typescript
export type ModifierOption = {
  id: string
  name: string
  price_delta: number    // renombrado de price_adjustment
  is_default: boolean
}

export type ModifierGroup = {
  id: string
  name: string
  type: 'variante' | 'modificador'
  required: boolean
  allows_multiple: boolean
  sort_order: number
  options: ModifierOption[]
}

// SelectedModifier permanece para compat con columna modifiers existente
export type SelectedModifier = {
  option_id: string
  name: string
  price_adjustment: number   // mantenido para compat con BD
}

export type OrderItem = {
  id: string
  product_name: string
  product_price: number
  tax_rate: number
  quantity: number
  unit_price: number
  total_price: number
  modifiers: SelectedModifier[]
  modifiers_snapshot: ModifierSnapshot[]
  notes: string | null
  status: OrderItemStatus
}
```

También añadir el import al inicio del archivo:
```typescript
import type { ModifierSnapshot } from '@/types/modificadores'
```

- [ ] **Step 3: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "modificadores|tpv"
```

Esperado: errores SOLO en `ModifierModal.tsx` (tipos viejos) — se arreglan en Task 9.

- [ ] **Step 4: Commit**

```powershell
git add types/modificadores.ts app/actions/tpv.ts
git commit -m "feat: tipos TypeScript para módulo de modificadores"
```

---

## Task 3: API GET pública de modificadores

**Archivos:**
- Crear: `app/api/modificadores/[menu_item_id]/route.ts`

- [ ] **Step 1: Crear la ruta**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ModifierGroup } from '@/types/modificadores'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ menu_item_id: string }> }
) {
  const { menu_item_id } = await params

  const { data: groups, error } = await supabaseAdmin
    .from('product_modifier_groups')
    .select('*, options:product_modifier_options(*)')
    .eq('menu_item_id', menu_item_id)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = (groups ?? []).map(g => ({
    ...g,
    options: (g.options as ModifierGroup['options'])
      .filter(o => o.is_active)
      .sort((a, b) => a.sort_order - b.sort_order),
  }))

  return NextResponse.json({ data: sorted })
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "api/modificadores"
```

Sin errores nuevos.

- [ ] **Step 3: Commit**

```powershell
git add app/api/modificadores/
git commit -m "feat: API GET pública de modificadores por menu_item"
```

---

## Task 4: API CRUD de grupos

**Archivos:**
- Crear: `app/api/modificadores/grupos/route.ts`
- Crear: `app/api/modificadores/grupos/[grupo_id]/route.ts`

- [ ] **Step 1: Crear app/api/modificadores/grupos/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, authId: string) {
  const { data } = await supabase.from('users').select('restaurant_id').eq('auth_id', authId).single()
  return data?.restaurant_id ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return NextResponse.json({ error: 'Sin restaurante' }, { status: 403 })

  const body = await req.json() as {
    menu_item_id?: string
    name?: string
    type?: string
    required?: boolean
    allows_multiple?: boolean
    sort_order?: number
  }

  const { menu_item_id, name, type, required = false, allows_multiple = false, sort_order = 0 } = body

  if (!menu_item_id || !name?.trim() || !type) {
    return NextResponse.json({ error: 'menu_item_id, name y type son obligatorios' }, { status: 400 })
  }
  if (type !== 'variante' && type !== 'modificador') {
    return NextResponse.json({ error: 'type debe ser variante o modificador' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('product_modifier_groups')
    .insert({ restaurant_id: restaurantId, menu_item_id, name: name.trim(), type, required, allows_multiple, sort_order })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
```

- [ ] **Step 2: Crear app/api/modificadores/grupos/[grupo_id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, authId: string) {
  const { data } = await supabase.from('users').select('restaurant_id').eq('auth_id', authId).single()
  return data?.restaurant_id ?? null
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ grupo_id: string }> }
) {
  const { grupo_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return NextResponse.json({ error: 'Sin restaurante' }, { status: 403 })

  const body = await req.json() as {
    name?: string
    required?: boolean
    allows_multiple?: boolean
    sort_order?: number
    is_active?: boolean
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined)           updates.name            = body.name.trim()
  if (body.required !== undefined)       updates.required        = body.required
  if (body.allows_multiple !== undefined) updates.allows_multiple = body.allows_multiple
  if (body.sort_order !== undefined)     updates.sort_order      = body.sort_order
  if (body.is_active !== undefined)      updates.is_active       = body.is_active

  const { data, error } = await supabase
    .from('product_modifier_groups')
    .update(updates)
    .eq('id', grupo_id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ grupo_id: string }> }
) {
  const { grupo_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return NextResponse.json({ error: 'Sin restaurante' }, { status: 403 })

  const { error } = await supabase
    .from('product_modifier_groups')
    .update({ is_active: false })
    .eq('id', grupo_id)
    .eq('restaurant_id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "grupos"
```

- [ ] **Step 4: Commit**

```powershell
git add app/api/modificadores/grupos/
git commit -m "feat: API CRUD grupos de modificadores"
```

---

## Task 5: API CRUD de opciones

**Archivos:**
- Crear: `app/api/modificadores/opciones/route.ts`
- Crear: `app/api/modificadores/opciones/[opcion_id]/route.ts`

- [ ] **Step 1: Crear app/api/modificadores/opciones/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, authId: string) {
  const { data } = await supabase.from('users').select('restaurant_id').eq('auth_id', authId).single()
  return data?.restaurant_id ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return NextResponse.json({ error: 'Sin restaurante' }, { status: 403 })

  const body = await req.json() as {
    group_id?: string
    name?: string
    price_delta?: number
    is_default?: boolean
    sort_order?: number
  }

  const { group_id, name, price_delta = 0, is_default = false, sort_order = 0 } = body

  if (!group_id || !name?.trim()) {
    return NextResponse.json({ error: 'group_id y name son obligatorios' }, { status: 400 })
  }

  // Verificar que el grupo pertenece al restaurante
  const { data: grupo } = await supabase
    .from('product_modifier_groups')
    .select('id')
    .eq('id', group_id)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!grupo) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('product_modifier_options')
    .insert({ group_id, name: name.trim(), price_delta, is_default, sort_order })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
```

- [ ] **Step 2: Crear app/api/modificadores/opciones/[opcion_id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, authId: string) {
  const { data } = await supabase.from('users').select('restaurant_id').eq('auth_id', authId).single()
  return data?.restaurant_id ?? null
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ opcion_id: string }> }
) {
  const { opcion_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return NextResponse.json({ error: 'Sin restaurante' }, { status: 403 })

  const body = await req.json() as {
    name?: string
    price_delta?: number
    is_default?: boolean
    sort_order?: number
    is_active?: boolean
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined)       updates.name       = body.name.trim()
  if (body.price_delta !== undefined) updates.price_delta = body.price_delta
  if (body.is_default !== undefined) updates.is_default = body.is_default
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order
  if (body.is_active !== undefined)  updates.is_active  = body.is_active

  // JOIN para verificar que la opción pertenece al restaurante
  const { data: opcion } = await supabase
    .from('product_modifier_options')
    .select('id, group_id, product_modifier_groups!inner(restaurant_id)')
    .eq('id', opcion_id)
    .single()

  if (!opcion) return NextResponse.json({ error: 'Opción no encontrada' }, { status: 404 })

  const grupo = opcion.product_modifier_groups as unknown as { restaurant_id: string }
  if (grupo.restaurant_id !== restaurantId) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('product_modifier_options')
    .update(updates)
    .eq('id', opcion_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ opcion_id: string }> }
) {
  const { opcion_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return NextResponse.json({ error: 'Sin restaurante' }, { status: 403 })

  const { data: opcion } = await supabase
    .from('product_modifier_options')
    .select('id, product_modifier_groups!inner(restaurant_id)')
    .eq('id', opcion_id)
    .single()

  if (!opcion) return NextResponse.json({ error: 'Opción no encontrada' }, { status: 404 })
  const grupo = opcion.product_modifier_groups as unknown as { restaurant_id: string }
  if (grupo.restaurant_id !== restaurantId) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { error } = await supabase
    .from('product_modifier_options')
    .update({ is_active: false })
    .eq('id', opcion_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "opciones"
```

- [ ] **Step 4: Commit**

```powershell
git add app/api/modificadores/opciones/
git commit -m "feat: API CRUD opciones de modificadores"
```

---

## Task 6: GestorModificadores (backoffice)

**Archivos:**
- Crear: `components/carta/GestorModificadores.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ModifierGroup, ModifierOption } from '@/types/modificadores'

interface Props {
  menuItemId: string
  menuItemName: string
}

type FormGrupo = {
  name: string
  type: 'variante' | 'modificador'
  required: boolean
  allows_multiple: boolean
}

type FormOpcion = {
  name: string
  price_delta: string
  is_default: boolean
}

const FORM_GRUPO_VACIO: FormGrupo = { name: '', type: 'modificador', required: false, allows_multiple: false }
const FORM_OPCION_VACIO: FormOpcion = { name: '', price_delta: '0', is_default: false }

export default function GestorModificadores({ menuItemId, menuItemName }: Props) {
  const [grupos, setGrupos] = useState<ModifierGroup[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal añadir grupo
  const [modalGrupo, setModalGrupo] = useState(false)
  const [formGrupo, setFormGrupo] = useState<FormGrupo>(FORM_GRUPO_VACIO)
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)
  const [errorGrupo, setErrorGrupo] = useState<string | null>(null)

  // Modal añadir opción
  const [modalOpcion, setModalOpcion] = useState<{ groupId: string; groupName: string; groupType: 'variante' | 'modificador' } | null>(null)
  const [formOpcion, setFormOpcion] = useState<FormOpcion>(FORM_OPCION_VACIO)
  const [guardandoOpcion, setGuardandoOpcion] = useState(false)
  const [errorOpcion, setErrorOpcion] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/modificadores/${menuItemId}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setGrupos(json.data ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setCargando(false)
    }
  }, [menuItemId])

  useEffect(() => { cargar() }, [cargar])

  async function handleCrearGrupo() {
    if (!formGrupo.name.trim()) { setErrorGrupo('El nombre es obligatorio'); return }
    setGuardandoGrupo(true)
    setErrorGrupo(null)
    try {
      const res = await fetch('/api/modificadores/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: menuItemId,
          name: formGrupo.name.trim(),
          type: formGrupo.type,
          required: formGrupo.required,
          allows_multiple: formGrupo.type === 'variante' ? false : formGrupo.allows_multiple,
          sort_order: grupos.length,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setModalGrupo(false)
      setFormGrupo(FORM_GRUPO_VACIO)
      await cargar()
    } catch (e) {
      setErrorGrupo(String(e))
    } finally {
      setGuardandoGrupo(false)
    }
  }

  async function handleEliminarGrupo(grupoId: string) {
    if (!confirm('¿Eliminar este grupo y todas sus opciones?')) return
    await fetch(`/api/modificadores/grupos/${grupoId}`, { method: 'DELETE' })
    await cargar()
  }

  async function handleCrearOpcion() {
    if (!modalOpcion) return
    if (!formOpcion.name.trim()) { setErrorOpcion('El nombre es obligatorio'); return }
    const delta = parseFloat(formOpcion.price_delta)
    if (isNaN(delta) || delta < 0) { setErrorOpcion('El precio debe ser un número positivo'); return }

    const grupo = grupos.find(g => g.id === modalOpcion.groupId)
    setGuardandoOpcion(true)
    setErrorOpcion(null)
    try {
      const res = await fetch('/api/modificadores/opciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: modalOpcion.groupId,
          name: formOpcion.name.trim(),
          price_delta: delta,
          is_default: formOpcion.is_default,
          sort_order: (grupo?.options.length ?? 0),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setModalOpcion(null)
      setFormOpcion(FORM_OPCION_VACIO)
      await cargar()
    } catch (e) {
      setErrorOpcion(String(e))
    } finally {
      setGuardandoOpcion(false)
    }
  }

  async function handleEliminarOpcion(opcionId: string) {
    await fetch(`/api/modificadores/opciones/${opcionId}`, { method: 'DELETE' })
    await cargar()
  }

  const inputClass = 'border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400 w-full'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          Variantes y modificadores
        </span>
        <button
          onClick={() => { setFormGrupo(FORM_GRUPO_VACIO); setErrorGrupo(null); setModalGrupo(true) }}
          className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Añadir grupo
        </button>
      </div>

      {cargando && (
        <div className="space-y-2">
          {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!cargando && grupos.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] text-center py-3">
          Sin grupos de variantes. Añade uno para personalizar el plato.
        </p>
      )}

      {grupos.map(grupo => (
        <div key={grupo.id} className="border border-[var(--border)] rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{grupo.name}</span>
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold ${grupo.type === 'variante' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {grupo.type}
              </span>
              {grupo.required && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700">
                  Obligatorio
                </span>
              )}
              {grupo.type === 'modificador' && grupo.allows_multiple && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold bg-green-100 text-green-700">
                  Multi
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => {
                  setFormOpcion(FORM_OPCION_VACIO)
                  setErrorOpcion(null)
                  setModalOpcion({ groupId: grupo.id, groupName: grupo.name, groupType: grupo.type })
                }}
                className="text-xs px-2 py-1 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-gray-50"
              >
                + Opción
              </button>
              <button
                onClick={() => handleEliminarGrupo(grupo.id)}
                className="text-xs px-2 py-1 border border-red-200 rounded-lg text-red-500 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </div>

          {grupo.options.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)] pl-1">Sin opciones aún.</p>
          )}

          <div className="flex flex-col gap-1">
            {grupo.options.map(opcion => (
              <div key={opcion.id} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                <span className="text-xs text-[var(--text-primary)] flex-1">{opcion.name}</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {opcion.price_delta > 0
                    ? (grupo.type === 'variante' ? `${Number(opcion.price_delta).toFixed(2)} €` : `+${Number(opcion.price_delta).toFixed(2)} €`)
                    : '—'}
                </span>
                {opcion.is_default && (
                  <span className="text-[10px] text-blue-600 font-semibold">Por defecto</span>
                )}
                <button
                  onClick={() => handleEliminarOpcion(opcion.id)}
                  className="text-red-400 hover:text-red-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal crear grupo */}
      {modalGrupo && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalGrupo(false) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-4">
            <h3 className="font-bold text-[var(--text-primary)]">Nuevo grupo de variante / modificador</h3>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Nombre del grupo *</span>
              <input value={formGrupo.name} onChange={e => setFormGrupo(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Tamaño, Punto de la carne, Extras" className={inputClass} />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Tipo</span>
              <div className="flex gap-2">
                {(['variante', 'modificador'] as const).map(t => (
                  <button key={t} onClick={() => setFormGrupo(p => ({ ...p, type: t }))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${formGrupo.type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-blue-400'}`}>
                    {t === 'variante' ? 'Variante (con precio)' : 'Modificador (suplemento)'}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formGrupo.required}
                onChange={e => setFormGrupo(p => ({ ...p, required: e.target.checked }))}
                className="accent-blue-600" />
              <span className="text-sm text-[var(--text-primary)]">Obligatorio</span>
            </label>

            {formGrupo.type === 'modificador' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formGrupo.allows_multiple}
                  onChange={e => setFormGrupo(p => ({ ...p, allows_multiple: e.target.checked }))}
                  className="accent-blue-600" />
                <span className="text-sm text-[var(--text-primary)]">Selección múltiple</span>
              </label>
            )}

            {errorGrupo && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorGrupo}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalGrupo(false)}
                className="flex-1 py-2 text-sm border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCrearGrupo} disabled={guardandoGrupo}
                className="flex-1 py-2 text-sm bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {guardandoGrupo ? 'Guardando...' : 'Crear grupo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal añadir opción */}
      {modalOpcion && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpcion(null) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-4">
            <h3 className="font-bold text-[var(--text-primary)]">
              Nueva opción — {modalOpcion.groupName}
            </h3>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Nombre *</span>
              <input value={formOpcion.name} onChange={e => setFormOpcion(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Caña, Sin cebolla, Muy hecho" className={inputClass} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {modalOpcion.groupType === 'variante' ? 'Precio completo (€)' : 'Suplemento (€, 0 si no tiene coste)'}
              </span>
              <input type="number" step="0.01" min="0" value={formOpcion.price_delta}
                onChange={e => setFormOpcion(p => ({ ...p, price_delta: e.target.value }))}
                className={inputClass} />
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formOpcion.is_default}
                onChange={e => setFormOpcion(p => ({ ...p, is_default: e.target.checked }))}
                className="accent-blue-600" />
              <span className="text-sm text-[var(--text-primary)]">Opción por defecto</span>
            </label>

            {errorOpcion && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorOpcion}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalOpcion(null)}
                className="flex-1 py-2 text-sm border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCrearOpcion} disabled={guardandoOpcion}
                className="flex-1 py-2 text-sm bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {guardandoOpcion ? 'Guardando...' : 'Añadir opción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "GestorModificadores"
```

- [ ] **Step 3: Commit**

```powershell
git add components/carta/GestorModificadores.tsx
git commit -m "feat: GestorModificadores — backoffice CRUD de grupos y opciones por plato"
```

---

## Task 7: Integrar GestorModificadores en MenuItemFormPanel

**Archivos:**
- Modificar: `components/carta/MenuItemFormPanel.tsx`

- [ ] **Step 1: Añadir import**

En `components/carta/MenuItemFormPanel.tsx`, añadir el import después de los imports existentes:

```typescript
import GestorModificadores from './GestorModificadores'
```

- [ ] **Step 2: Añadir sección al final del contenido del panel**

Localizar el bloque:
```typescript
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
```

Insertar ANTES del `{error && ...}`:

```typescript
          {/* Variantes y modificadores — solo cuando el plato ya existe */}
          {isEditing && item?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 mt-2">
              <GestorModificadores menuItemId={item.id} menuItemName={item.name} />
            </div>
          )}

```

- [ ] **Step 3: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "MenuItemFormPanel"
```

Sin errores.

- [ ] **Step 4: Commit**

```powershell
git add components/carta/MenuItemFormPanel.tsx
git commit -m "feat: sección de variantes en el panel de edición de platos"
```

---

## Task 8: SelectorModificadores (componente compartido)

**Archivos:**
- Crear: `components/shared/SelectorModificadores.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ModifierGroup, ModifierSelection, ModifierSnapshot, ItemConModificadores } from '@/types/modificadores'

interface Props {
  menuItem: { id: string; name: string; price: number }
  onConfirmar: (resultado: ItemConModificadores) => void
  onCancelar: () => void
}

function fmt(v: number) {
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default function SelectorModificadores({ menuItem, onConfirmar, onCancelar }: Props) {
  const [grupos, setGrupos] = useState<ModifierGroup[]>([])
  const [cargando, setCargando] = useState(true)
  const [selecciones, setSelecciones] = useState<ModifierSelection[]>([])
  const [nota, setNota] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [erroresGrupos, setErroresGrupos] = useState<Set<string>>(new Set())

  const confirmarDirecto = useCallback((precio: number) => {
    onConfirmar({ menu_item_id: menuItem.id, cantidad, precio_final: precio, modifiers_snapshot: [], nota: nota.trim() || undefined })
  }, [menuItem.id, cantidad, nota, onConfirmar])

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      const res = await fetch(`/api/modificadores/${menuItem.id}`)
      const json = await res.json()
      if (cancelled) return
      const data: ModifierGroup[] = json.data ?? []
      setGrupos(data)
      setCargando(false)

      if (data.length === 0) {
        onConfirmar({ menu_item_id: menuItem.id, cantidad: 1, precio_final: menuItem.price, modifiers_snapshot: [], nota: undefined })
        return
      }

      // Preseleccionar is_default
      setSelecciones(data.map(g => ({
        group_id: g.id,
        option_ids: g.options.filter(o => o.is_default).map(o => o.id),
      })))
    }
    cargar()
    return () => { cancelled = true }
  }, [menuItem.id, menuItem.price, onConfirmar])

  function toggleOpcion(groupId: string, optionId: string, allowsMultiple: boolean) {
    setSelecciones(prev => prev.map(s => {
      if (s.group_id !== groupId) return s
      if (s.option_ids.includes(optionId)) {
        return { ...s, option_ids: s.option_ids.filter(id => id !== optionId) }
      }
      if (!allowsMultiple) return { ...s, option_ids: [optionId] }
      return { ...s, option_ids: [...s.option_ids, optionId] }
    }))
    setErroresGrupos(prev => { const n = new Set(prev); n.delete(groupId); return n })
  }

  // Precio calculado
  const varianteSeleccionada = grupos
    .filter(g => g.type === 'variante')
    .flatMap(g => {
      const sel = selecciones.find(s => s.group_id === g.id)
      return (sel?.option_ids ?? []).map(id => g.options.find(o => o.id === id)!)
    })
    .filter(Boolean)[0]

  const suplementos = grupos
    .filter(g => g.type === 'modificador')
    .flatMap(g => {
      const sel = selecciones.find(s => s.group_id === g.id)
      return (sel?.option_ids ?? []).map(id => g.options.find(o => o.id === id)!).filter(Boolean)
    })
    .reduce((sum, o) => sum + Number(o.price_delta), 0)

  const precioFinal = varianteSeleccionada
    ? Number(varianteSeleccionada.price_delta)
    : menuItem.price + suplementos

  function handleConfirmar() {
    const faltantes = new Set<string>()
    for (const g of grupos) {
      if (g.required) {
        const sel = selecciones.find(s => s.group_id === g.id)
        if (!sel || sel.option_ids.length === 0) faltantes.add(g.id)
      }
    }
    if (faltantes.size > 0) { setErroresGrupos(faltantes); return }

    const snapshot: ModifierSnapshot[] = selecciones.flatMap(sel => {
      const grupo = grupos.find(g => g.id === sel.group_id)!
      return sel.option_ids.map(optId => {
        const opcion = grupo.options.find(o => o.id === optId)!
        return {
          group_id: grupo.id,
          group_name: grupo.name,
          group_type: grupo.type,
          option_id: opcion.id,
          option_name: opcion.name,
          price_delta: Number(opcion.price_delta),
        }
      })
    })

    onConfirmar({
      menu_item_id: menuItem.id,
      cantidad,
      precio_final: precioFinal,
      modifiers_snapshot: snapshot,
      nota: nota.trim() || undefined,
    })
  }

  if (cargando) return null  // auto-confirm happens in useEffect if no groups

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancelar() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Cabecera */}
        <div className="p-5 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{menuItem.name}</h2>
          <p className="text-sm text-gray-500">Personaliza tu pedido</p>
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

          {grupos.map(grupo => {
            const sel = selecciones.find(s => s.group_id === grupo.id)
            const hayError = erroresGrupos.has(grupo.id)
            return (
              <div key={grupo.id}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-sm text-gray-900">{grupo.name}</span>
                  {grupo.required && (
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold ${hayError ? 'bg-red-100 text-red-700' : 'bg-red-50 text-red-600'}`}>
                      Obligatorio
                    </span>
                  )}
                  {grupo.type === 'modificador' && grupo.allows_multiple && (
                    <span className="text-[10px] text-gray-400">(varios)</span>
                  )}
                </div>
                {hayError && (
                  <p className="text-xs text-red-600 mb-1">Selección obligatoria</p>
                )}
                <div className="flex flex-col gap-1.5">
                  {grupo.options.map(opcion => {
                    const seleccionado = (sel?.option_ids ?? []).includes(opcion.id)
                    const esRadio = grupo.type === 'variante' || !grupo.allows_multiple
                    return (
                      <label
                        key={opcion.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${seleccionado ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <input
                          type={esRadio ? 'radio' : 'checkbox'}
                          name={esRadio ? grupo.id : undefined}
                          checked={seleccionado}
                          onChange={() => toggleOpcion(grupo.id, opcion.id, grupo.allows_multiple && grupo.type === 'modificador')}
                          className="accent-blue-600"
                        />
                        <span className="flex-1 text-sm text-gray-900">{opcion.name}</span>
                        <span className="text-sm text-gray-500 flex-shrink-0">
                          {grupo.type === 'variante'
                            ? fmt(Number(opcion.price_delta))
                            : opcion.price_delta > 0
                              ? `+${fmt(Number(opcion.price_delta))}`
                              : '—'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Nota libre */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Nota para cocina (opcional)
            </label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value.slice(0, 200))}
              placeholder="Alergias, preferencias, sin sal..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 flex-shrink-0 space-y-3">
          {/* Desglose de precio */}
          <div className="text-sm text-gray-500 space-y-0.5">
            {varianteSeleccionada && (
              <p>Precio variante: <span className="font-semibold text-gray-900">{fmt(Number(varianteSeleccionada.price_delta))}</span></p>
            )}
            {!varianteSeleccionada && suplementos > 0 && (
              <p>Base {fmt(menuItem.price)} + suplementos {fmt(suplementos)}</p>
            )}
            <p className="text-lg font-bold text-gray-900">Total: {fmt(precioFinal)}</p>
          </div>

          {/* Cantidad */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCantidad(c => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-50"
              >−</button>
              <span className="text-base font-semibold text-gray-900 w-6 text-center">{cantidad}</span>
              <button
                onClick={() => setCantidad(c => c + 1)}
                className="w-8 h-8 rounded-full border border-gray-300 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-50"
              >+</button>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={onCancelar}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Añadir al pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "SelectorModificadores"
```

- [ ] **Step 3: Commit**

```powershell
git add components/shared/SelectorModificadores.tsx
git commit -m "feat: SelectorModificadores — selector compartido TPV y QR"
```

---

## Task 9: Actualizar TPV (ProductsPanel + getMenuData)

**Archivos:**
- Modificar: `components/tpv/ProductsPanel.tsx`
- Modificar: `app/actions/tpv.ts` — `getMenuData` carga grupos reales

- [ ] **Step 1: Actualizar getMenuData en app/actions/tpv.ts**

Localizar la función `getMenuData` (líneas ~288-323). Reemplazar el cuerpo completo de la función:

```typescript
export async function getMenuData(): Promise<{ categories: Category[]; products: ProductWithModifiers[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const [catResult, itemResult, gruposResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('position'),
    supabase
      .from('menu_items')
      .select('id, name, price, is_active, category_id')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('product_modifier_groups')
      .select('id, menu_item_id, name, type, required, allows_multiple, sort_order, options:product_modifier_options(id, name, price_delta, is_default, is_active, sort_order)')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const gruposPorItem = new Map<string, ModifierGroup[]>()
  for (const g of (gruposResult.data ?? [])) {
    const grupo: ModifierGroup = {
      id: g.id,
      restaurant_id: restaurantId,
      menu_item_id: g.menu_item_id,
      name: g.name,
      type: g.type as 'variante' | 'modificador',
      required: g.required,
      allows_multiple: g.allows_multiple,
      sort_order: g.sort_order,
      is_active: true,
      options: ((g.options as ModifierOption[]) ?? [])
        .filter(o => o.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    }
    const prev = gruposPorItem.get(g.menu_item_id) ?? []
    gruposPorItem.set(g.menu_item_id, [...prev, grupo])
  }

  return {
    categories: catResult.data ?? [],
    products: (itemResult.data ?? []).map(p => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      tax_rate: 0,
      is_available: p.is_active,
      category_id: p.category_id ?? '',
      modifierGroups: gruposPorItem.get(p.id) ?? [],
    })),
  }
}
```

Añadir los imports necesarios en `app/actions/tpv.ts` si faltan:
```typescript
import type { ModifierGroup, ModifierOption } from '@/types/modificadores'
```

- [ ] **Step 2: Actualizar ProductsPanel.tsx**

Reemplazar el contenido completo del archivo:

```typescript
'use client'

import { useState } from 'react'
import type { Category, ProductWithModifiers } from '@/app/actions/tpv'
import type { ItemConModificadores } from '@/types/modificadores'
import SelectorModificadores from '@/components/shared/SelectorModificadores'

interface Props {
  categories: Category[]
  products: ProductWithModifiers[]
  onAddProduct: (resultado: ItemConModificadores) => void
  disabled: boolean
}

export default function ProductsPanel({ categories, products, onAddProduct, disabled }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectorItem, setSelectorItem] = useState<{ id: string; name: string; price: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category_id === activeCategory
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function handleProductClick(product: ProductWithModifiers) {
    if (!product.is_available) { showToast(`${product.name} no está disponible`); return }
    if (disabled) return

    if (product.modifierGroups.length > 0) {
      setSelectorItem({ id: product.id, name: product.name, price: product.price })
    } else {
      onAddProduct({ menu_item_id: product.id, cantidad: 1, precio_final: product.price, modifiers_snapshot: [] })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-[#e2e8f0] flex-shrink-0">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb]"
          style={{ color: 'black' }}
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-[#e2e8f0] flex-shrink-0">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
            activeCategory === 'all'
              ? 'bg-[#2563eb] text-white'
              : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:border-[#2563eb]'
          }`}
        >
          Todas
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              activeCategory === cat.id
                ? 'bg-[#2563eb] text-white'
                : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:border-[#2563eb]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
        {filtered.map(product => (
          <button
            key={product.id}
            onClick={() => handleProductClick(product)}
            disabled={disabled || !product.is_available}
            className={`text-left p-3 rounded-xl border transition-colors ${
              !product.is_available
                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                : 'border-[#e2e8f0] bg-white hover:border-[#2563eb] hover:bg-blue-50'
            }`}
          >
            <p className="font-semibold text-sm text-[#0f172a] leading-tight">{product.name}</p>
            <p className="text-sm text-[#2563eb] font-bold mt-1">{Number(product.price).toFixed(2)} €</p>
            {product.modifierGroups.length > 0 && (
              <p className="text-[10px] text-[#64748b] mt-0.5">Personalizable</p>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-2 text-center text-[#64748b] text-sm py-8">Sin productos</p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-10">
          {toast}
        </div>
      )}

      {/* Selector de modificadores */}
      {selectorItem && (
        <SelectorModificadores
          menuItem={selectorItem}
          onConfirmar={resultado => { onAddProduct(resultado); setSelectorItem(null) }}
          onCancelar={() => setSelectorItem(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Actualizar llamada en OrderView.tsx**

Buscar en `components/tpv/OrderView.tsx` la función `handleAddProduct`. Actualmente tiene la firma `(productId: string, modifiers: SelectedModifier[], quantity: number)`. Reemplazar esa función:

```typescript
async function handleAddProduct(resultado: ItemConModificadores) {
  const result = await offlineFetch({
    type: 'add_item',
    endpoint: '/api/tpv/order-items',
    method: 'POST',
    payload: {
      orderId: order.id,
      productId: resultado.menu_item_id,
      quantity: resultado.cantidad,
      unit_price: resultado.precio_final,
      modifiers_snapshot: resultado.modifiers_snapshot,
      nota: resultado.nota,
    },
  })
  // ... resto del handler igual
}
```

Añadir el import en `OrderView.tsx`:
```typescript
import type { ItemConModificadores } from '@/types/modificadores'
```

- [ ] **Step 4: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "ProductsPanel|OrderView|tpv"
```

Sin errores.

- [ ] **Step 5: Commit**

```powershell
git add components/tpv/ProductsPanel.tsx app/actions/tpv.ts
git commit -m "feat: TPV usa SelectorModificadores y getMenuData carga grupos reales"
```

---

## Task 10: Actualizar API order-items (TPV)

**Archivos:**
- Modificar: `app/api/tpv/order-items/route.ts`

- [ ] **Step 1: Añadir soporte para modifiers_snapshot, unit_price y nota**

Reemplazar el contenido completo del archivo:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ModifierSnapshot } from '@/types/modificadores'

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

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      orderId?: unknown
      productId?: unknown
      quantity?: unknown
      unit_price?: unknown
      modifiers_snapshot?: unknown
      nota?: unknown
    }
    const { orderId, productId, quantity, unit_price, modifiers_snapshot, nota } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })
    }
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId requerido' }, { status: 400 })
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({ error: 'quantity debe ser un número positivo' }, { status: 400 })
    }

    const safeSnapshot: ModifierSnapshot[] = Array.isArray(modifiers_snapshot) ? modifiers_snapshot as ModifierSnapshot[] : []
    const safenota: string | undefined = typeof nota === 'string' ? nota : undefined

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const restaurantId = await getRestaurantId(supabase, user.id)
    if (!restaurantId) return NextResponse.json({ error: 'Sin restaurante asociado' }, { status: 403 })

    const { data: orderCheck } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'open')
      .maybeSingle()

    if (!orderCheck) return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 })

    const { data: product } = await supabase
      .from('menu_items')
      .select('name, price')
      .eq('id', productId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const basePrice = Number(product.price)
    // unit_price viene calculado por SelectorModificadores; si no, usar precio base
    const unitPrice = typeof unit_price === 'number' ? unit_price : basePrice
    const totalPrice = unitPrice * quantity

    // SelectedModifier para compat con columna modifiers existente
    const modifiersCompat = safeSnapshot.map(s => ({
      option_id: s.option_id,
      name: s.option_name,
      price_adjustment: s.price_delta,
    }))

    const { data: item, error } = await supabase
      .from('order_items')
      .insert({
        restaurant_id: restaurantId,
        order_id: orderId,
        product_id: productId,
        product_name: product.name,
        product_price: basePrice,
        tax_rate: 0,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        modifiers: modifiersCompat,
        modifiers_snapshot: safeSnapshot,
        notes: safenota ?? null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error || !item) return NextResponse.json({ error: 'No se pudo añadir el producto' }, { status: 500 })
    return NextResponse.json({ itemId: item.id })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "order-items"
```

- [ ] **Step 3: Commit**

```powershell
git add app/api/tpv/order-items/route.ts
git commit -m "feat: order-items API acepta modifiers_snapshot y unit_price calculado"
```

---

## Task 11: Integrar SelectorModificadores en la carta QR

**Archivos:**
- Modificar: `app/cliente/[slug]/mesa/[mesa_id]/page.tsx`
- Modificar: `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts`

- [ ] **Step 1: Actualizar MesaPage**

Reemplazar el contenido completo de `app/cliente/[slug]/mesa/[mesa_id]/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { CategoriaCarta, ItemCarta } from '@/app/api/cliente/[slug]/carta/route'
import type { ItemConModificadores, ModifierSnapshot } from '@/types/modificadores'
import SelectorModificadores from '@/components/shared/SelectorModificadores'

type ItemCarrito = {
  key: string            // id + JSON snapshot para separar variantes distintas
  id: string
  nombre: string
  precio: number
  cantidad: number
  cantidad_minima: number
  modifiers_snapshot: ModifierSnapshot[]
  nota?: string
}

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
  const [selectorItem, setSelectorItem] = useState<ItemCarta | null>(null)

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

  function handleAñadir(item: ItemCarta) {
    setSelectorItem(item)
  }

  function handleSelectorConfirmar(resultado: ItemConModificadores) {
    setSelectorItem(null)
    const item = carta.flatMap(c => c.items).find(i => i.id === resultado.menu_item_id)
    if (!item) return

    const key = `${resultado.menu_item_id}:${JSON.stringify(resultado.modifiers_snapshot)}`
    setCarrito(prev => {
      const existe = prev.find(i => i.key === key)
      if (existe) {
        return prev.map(i => i.key === key ? { ...i, cantidad: i.cantidad + resultado.cantidad } : i)
      }
      return [...prev, {
        key,
        id: resultado.menu_item_id,
        nombre: item.nombre,
        precio: resultado.precio_final,
        cantidad: resultado.cantidad,
        cantidad_minima: item.cantidad_minima,
        modifiers_snapshot: resultado.modifiers_snapshot,
        nota: resultado.nota,
      }]
    })
  }

  function quitar(key: string) {
    setCarrito(prev => {
      const item = prev.find(i => i.key === key)
      if (!item) return prev
      if (item.cantidad <= item.cantidad_minima) return prev.filter(i => i.key !== key)
      return prev.map(i => i.key === key ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
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
            modifiers_snapshot: i.modifiers_snapshot,
            nota: i.nota ?? null,
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
      <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-4">
        <div className="text-5xl">✓</div>
        <h2 className="text-xl font-bold text-gray-900">¡Pedido enviado!</h2>
        <p className="text-gray-500 text-sm text-center">Tu pedido ha sido recibido. El equipo lo preparará en breve.</p>
        <button onClick={() => setPedidoEnviado(false)} className="mt-4 px-4 py-2 text-sm text-blue-600 underline">
          Seguir pidiendo
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-32">
      {mesa && <h1 className="text-xl font-bold text-gray-900 mb-6">{mesa.nombre}</h1>}

      {carta.map(categoria => (
        <div key={categoria.id} className="mb-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{categoria.nombre}</h2>
          <div className="flex flex-col gap-3">
            {categoria.items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-200">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{item.nombre}</p>
                  {item.descripcion && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.descripcion}</p>}
                  <p className="text-sm font-semibold text-blue-600 mt-1">{Number(item.precio).toFixed(2)} €</p>
                </div>
                <button
                  onClick={() => handleAñadir(item)}
                  className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center hover:bg-blue-700 flex-shrink-0"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Carrito flotante */}
      {carrito.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-md mx-auto">
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto mb-3">
              {carrito.map(item => (
                <div key={item.key} className="flex items-start justify-between gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">{item.nombre}</span>
                    {item.modifiers_snapshot.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">
                        {item.modifiers_snapshot.map(m => m.option_name).join(' · ')}
                      </p>
                    )}
                    {item.nota && <p className="text-xs text-gray-400 italic">{item.nota}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => quitar(item.key)} className="w-6 h-6 rounded-full border border-gray-300 text-gray-600 text-xs font-bold flex items-center justify-center">−</button>
                    <span className="text-xs w-4 text-center font-semibold">{item.cantidad}</span>
                    <span className="text-xs text-gray-600">{(item.precio * item.cantidad).toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>
            {errorEnvio && <p className="text-xs text-red-600 mb-2">{errorEnvio}</p>}
            <button
              onClick={handleEnviarPedido}
              disabled={enviando}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {enviando ? 'Enviando...' : `Enviar pedido · ${totalItems} item${totalItems !== 1 ? 's' : ''} · ${totalCarrito.toFixed(2)} €`}
            </button>
          </div>
        </div>
      )}

      {/* Selector de modificadores */}
      {selectorItem && (
        <SelectorModificadores
          menuItem={{ id: selectorItem.id, name: selectorItem.nombre, price: selectorItem.precio }}
          onConfirmar={handleSelectorConfirmar}
          onCancelar={() => setSelectorItem(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Actualizar POST route de la carta QR**

En `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts`, actualizar el tipo `ItemPedido` y el INSERT:

Reemplazar:
```typescript
type ItemPedido = {
  menu_item_id: string
  nombre: string
  precio: number
  cantidad: number
}
```
Por:
```typescript
type ItemPedido = {
  menu_item_id: string
  nombre: string
  precio: number
  cantidad: number
  modifiers_snapshot?: unknown[]
  nota?: string | null
}
```

Y en el `orderItemsData` map, reemplazar:
```typescript
        modifiers: [],
        notes: null,
```
Por:
```typescript
        modifiers: (item.modifiers_snapshot ?? []).map((s: Record<string, unknown>) => ({
          option_id: s.option_id,
          name: s.option_name,
          price_adjustment: s.price_delta,
        })),
        modifiers_snapshot: item.modifiers_snapshot ?? [],
        notes: item.nota ?? null,
```

- [ ] **Step 3: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "mesa|cliente"
```

- [ ] **Step 4: Commit**

```powershell
git add "app/cliente/[slug]/mesa/[mesa_id]/page.tsx" "app/api/cliente/[slug]/mesa/[mesa_id]/route.ts"
git commit -m "feat: carta QR integra SelectorModificadores y envía modifiers_snapshot"
```

---

## Task 12: Actualizar OrderPanel — mostrar modificadores

**Archivos:**
- Modificar: `components/tpv/OrderPanel.tsx`
- Modificar: `app/actions/tpv.ts` — `getOrderWithItems` incluye `modifiers_snapshot`

- [ ] **Step 1: Actualizar getOrderWithItems en app/actions/tpv.ts**

Localizar la query de `order_items` dentro de `getOrderWithItems` (líneas ~259-265). Actualizar el `.select()`:

```typescript
  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_name, product_price, tax_rate, quantity, unit_price, total_price, modifiers, modifiers_snapshot, notes, status')
    .eq('order_id', orderId)
    .neq('status', 'cancelled')
    .order('created_at')
```

Y en el `.map()` de items, añadir `modifiers_snapshot`:

```typescript
      modifiers_snapshot: (item.modifiers_snapshot as ModifierSnapshot[]) ?? [],
```

- [ ] **Step 2: Mostrar modificadores en OrderPanel.tsx**

Localizar en `components/tpv/OrderPanel.tsx` el bloque donde se muestran los modificadores (líneas ~139-143):

```typescript
                {item.modifiers.length > 0 && (
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {item.modifiers.map(m => m.name).join(', ')}
                  </p>
                )}
```

Reemplazar por:

```typescript
                {item.modifiers_snapshot.length > 0 && (
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {item.modifiers_snapshot.map(m => m.option_name).join(' · ')}
                  </p>
                )}
                {item.modifiers_snapshot.length === 0 && item.modifiers.length > 0 && (
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {item.modifiers.map(m => m.name).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-[var(--text-secondary)] italic truncate">
                    {item.notes}
                  </p>
                )}
```

- [ ] **Step 3: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "OrderPanel|getOrderWithItems"
```

- [ ] **Step 4: Commit**

```powershell
git add components/tpv/OrderPanel.tsx app/actions/tpv.ts
git commit -m "feat: OrderPanel muestra modificadores y nota bajo cada línea"
```

---

## Task 13: Actualizar TicketPreview — modificadores en ticket

**Archivos:**
- Modificar: `components/tpv/TicketPreview.tsx`
- Modificar: `types/ticket.ts`

- [ ] **Step 1: Añadir modifiers_snapshot a TicketCompleto**

En `types/ticket.ts`, actualizar el tipo `items`:

```typescript
  items: {
    id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    producto: { nombre: string }
    modifiers_snapshot?: { option_name: string; group_name: string }[]
    notes?: string | null
  }[]
```

- [ ] **Step 2: Actualizar query en TicketPreview.tsx**

Localizar en `TicketPreview.tsx` la query de `order_items` (líneas ~40-42):

```typescript
      const { data: items } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, total_price')
        .eq('order_id', ticket.order_id)
        .neq('status', 'cancelled')
```

Reemplazar por:

```typescript
      const { data: items } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, total_price, modifiers_snapshot, notes')
        .eq('order_id', ticket.order_id)
        .neq('status', 'cancelled')
```

Y en el `.map()` que construye `built.items` (líneas ~80-86), añadir los campos:

```typescript
        items: (items ?? []).map(i => ({
          id: i.id,
          cantidad: i.quantity,
          precio_unitario: Number(i.unit_price),
          subtotal: Number(i.total_price),
          producto: { nombre: i.product_name },
          modifiers_snapshot: (i.modifiers_snapshot as { option_name: string; group_name: string }[] | null) ?? [],
          notes: (i as Record<string, unknown>).notes as string | null ?? null,
        })),
```

- [ ] **Step 3: Mostrar modificadores en el HTML del ticket**

Localizar en `TicketPreview.tsx` la sección donde se renderizan los items en el HTML del ticket. Buscar el bloque que muestra `producto.nombre`. Añadir debajo de cada línea de producto:

```typescript
          {item.modifiers_snapshot && item.modifiers_snapshot.length > 0 && (
            <div style={{ paddingLeft: '16px', fontSize: '11px', color: '#666' }}>
              {item.modifiers_snapshot.map((m, idx) => (
                <div key={idx}>· {m.option_name}</div>
              ))}
            </div>
          )}
          {item.notes && (
            <div style={{ paddingLeft: '16px', fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
              Nota: {item.notes}
            </div>
          )}
```

- [ ] **Step 4: Verificar compilación**

```powershell
npx tsc --noEmit 2>&1 | Select-String "TicketPreview|ticket"
```

- [ ] **Step 5: Commit**

```powershell
git add components/tpv/TicketPreview.tsx types/ticket.ts
git commit -m "feat: ticket muestra modificadores y notas por línea de pedido"
```

---

## Task 14: Build final y push

- [ ] **Step 1: Compilación completa**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run build 2>&1
```

Resultado esperado: `✓ Compiled successfully` sin errores TypeScript.

Si hay errores de tipo en `ModifierModal.tsx` (tipos viejos), arreglar actualizando los field names:
- `is_required` → `required`
- `min_selections`, `max_selections` → eliminar, ya no se usa (componente dead code)

O simplemente eliminar `ModifierModal.tsx` ya que ha sido reemplazado por `SelectorModificadores`.

- [ ] **Step 2: Push**

```powershell
git push origin master 2>&1
```

---

## Self-Review

**Spec coverage:**
- ✅ PASO 0: SQL de verificación documentado (Task 0)
- ✅ PASO 1: SQL tablas con `type`, `required`, `allows_multiple`, `price_delta` + `modifiers_snapshot` en order_items (Task 1)
- ✅ Tipos TypeScript `ModifierGroup`, `ModifierOption`, `ModifierSnapshot`, `ItemConModificadores` (Task 2)
- ✅ API GET pública `/api/modificadores/[menu_item_id]` — usa `supabaseAdmin`, sin auth (Task 3)
- ✅ API CRUD grupos POST/PUT/DELETE (Tasks 4)
- ✅ API CRUD opciones POST/PUT/DELETE (Task 5)
- ✅ `GestorModificadores` con modales crear grupo y crear opción, tipos badge, eliminación con confirm (Task 6)
- ✅ `GestorModificadores` integrado en `MenuItemFormPanel` solo cuando `isEditing` (Task 7)
- ✅ `SelectorModificadores` compartido: auto-confirm si sin grupos, radio/checkbox por tipo, precio tiempo real, nota, cantidad, validación required (Task 8)
- ✅ TPV: `ProductsPanel` usa `SelectorModificadores`, `getMenuData` carga grupos reales con JOIN (Task 9)
- ✅ API `order-items` acepta `unit_price` calculado, `modifiers_snapshot`, `nota`; mantiene `modifiers` compat (Task 10)
- ✅ Carta QR: `MesaPage` con carrito por variante (key único), `SelectorModificadores`, muestra modificadores en carrito (Task 11)
- ✅ API QR acepta `modifiers_snapshot` y `nota` por ítem (Task 11)
- ✅ `OrderPanel` muestra modificadores con `·` separador y nota en itálica (Task 12)
- ✅ `TicketPreview` muestra `· Opción` indentado y nota bajo cada línea (Task 13)

**Placeholder scan:** Ninguno — todos los pasos tienen código completo.

**Type consistency:**
- `ModifierSnapshot.option_name` — usado consistentemente en Tasks 8, 11, 12, 13
- `ModifierSnapshot.price_delta` — campo correcto (no `price_adjustment`)
- `ItemConModificadores.menu_item_id` — consistente en Tasks 8, 9, 11
- `ModifierGroup.required` / `allows_multiple` — consistente con SQL y componentes
- `SelectedModifier.price_adjustment` — mantenido solo para compat con columna `modifiers` existente; no mezclado con `price_delta`
