# Superadmin Acceso Remoto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al superadmin acceder al dashboard de cualquier restaurante con permisos completos mediante una cookie de override y el admin client de Supabase.

**Architecture:** Una función central `getRestaurantContext()` en `lib/auth/restaurant-context.ts` detecta la cookie `sa_restaurant_id`, verifica que el caller es superadmin, y devuelve el admin client + el restaurantId del override. Los 6 archivos de actions reemplazan sus bloques `getRestaurantId` locales por una llamada a esta función. Un banner en el layout del dashboard indica el modo remoto activo.

**Tech Stack:** Next.js App Router server components, server actions, `next/headers` cookies, Supabase admin client.

## Global Constraints

- Cookie: `sa_restaurant_id`, `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, sin `maxAge` (expira al cerrar navegador).
- CSS vars del proyecto: `--bg-surface`, `--bg-page`, `--text-primary`, `--text-secondary`, `--border`, `--accent`, `--accent-hover`.
- Admin client: siempre vía `getSupabaseAdmin()` de `@/lib/supabase/admin` (nunca instanciar directamente).
- Todos los archivos de actions usan `'use server'` en la primera línea.
- No añadir dependencias nuevas.

---

### Task 1: `lib/auth/restaurant-context.ts` — Función central de contexto

**Files:**
- Create: `lib/auth/restaurant-context.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SA_COOKIE = 'sa_restaurant_id'

  export interface RestaurantContext {
    supabase: import('@supabase/supabase-js').SupabaseClient
    restaurantId: string
    userId: string        // auth UUID — para audit fields (created_by, deleted_by, etc.)
    isSuperadminMode: boolean
  }

  export async function getRestaurantContext(): Promise<RestaurantContext | null>
  ```

- [ ] **Step 1: Crear `lib/auth/restaurant-context.ts`**

```ts
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SA_COOKIE = 'sa_restaurant_id'

export interface RestaurantContext {
  supabase: SupabaseClient
  restaurantId: string
  userId: string
  isSuperadminMode: boolean
}

export async function getRestaurantContext(): Promise<RestaurantContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const overrideId = cookieStore.get(SA_COOKIE)?.value

  if (overrideId) {
    const admin = getSupabaseAdmin()
    const { data: callerUser } = await admin
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (callerUser) {
      const { data: roleRows } = await admin
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', callerUser.id)
      const esSuperadmin = (roleRows ?? []).some((r: any) => r.roles?.name === 'superadmin')

      if (esSuperadmin) {
        return {
          supabase: admin,
          restaurantId: overrideId,
          userId: user.id,
          isSuperadminMode: true,
        }
      }
    }
    // No es superadmin — ignorar la cookie, flujo normal
  }

  // Flujo normal
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()

  if (!data?.restaurant_id) return null

  return {
    supabase,
    restaurantId: data.restaurant_id,
    userId: user.id,
    isSuperadminMode: false,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth/restaurant-context.ts
git commit -m "feat(auth): add getRestaurantContext with superadmin override support"
```

---

### Task 2: Server actions `iniciarSesionRemota` y `cerrarSesionRemota`

**Files:**
- Modify: `app/actions/superadmin.ts`

**Interfaces:**
- Consumes: `SA_COOKIE` de `@/lib/auth/restaurant-context`
- Produces:
  ```ts
  export async function iniciarSesionRemota(restaurantId: string): Promise<never>
  export async function cerrarSesionRemota(): Promise<never>
  ```

- [ ] **Step 1: Añadir imports necesarios en `app/actions/superadmin.ts`**

Al principio del archivo, junto a los imports existentes, añadir:
```ts
import { cookies } from 'next/headers'
import { SA_COOKIE } from '@/lib/auth/restaurant-context'
```

El archivo ya importa `createClient`, `getSupabaseAdmin`, `redirect` — no duplicar.

- [ ] **Step 2: Añadir las dos actions al final del archivo**

```ts
export async function iniciarSesionRemota(restaurantId: string): Promise<never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getSupabaseAdmin()
  const { data: callerUser } = await admin
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  if (!callerUser) redirect('/login')

  const { data: roleRows } = await admin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', callerUser.id)
  const esSuperadmin = (roleRows ?? []).some((r: any) => r.roles?.name === 'superadmin')
  if (!esSuperadmin) redirect('/superadmin')

  const cookieStore = await cookies()
  cookieStore.set(SA_COOKIE, restaurantId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  redirect('/dashboard')
}

export async function cerrarSesionRemota(): Promise<never> {
  const cookieStore = await cookies()
  cookieStore.delete(SA_COOKIE)
  redirect('/superadmin')
}
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/superadmin.ts
git commit -m "feat(superadmin): add iniciarSesionRemota and cerrarSesionRemota actions"
```

---

### Task 3: Botón "Acceder" en la lista de restaurantes

**Files:**
- Modify: `app/superadmin/SuperadminRestaurantesList.tsx`

**Interfaces:**
- Consumes: `iniciarSesionRemota` de `@/app/actions/superadmin`

- [ ] **Step 1: Añadir import y columna "Acceder" en `SuperadminRestaurantesList.tsx`**

Añadir al bloque de imports al inicio del archivo:
```ts
import { iniciarSesionRemota } from '@/app/actions/superadmin'
```

En el `<thead>`, añadir una columna vacía al final:
```tsx
<th className="px-4 py-3" />
```

En cada `<tr>` de la tabla (dentro del `.map`), añadir la última celda antes del cierre `</tr>`:
```tsx
<td className="px-4 py-3 text-right">
  <form action={iniciarSesionRemota.bind(null, r.id)}>
    <button
      type="submit"
      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
    >
      Acceder
    </button>
  </form>
</td>
```

- [ ] **Step 2: Commit**

```bash
git add app/superadmin/SuperadminRestaurantesList.tsx
git commit -m "feat(superadmin): add Acceder button to restaurant list"
```

---

### Task 4: Banner en el dashboard layout

**Files:**
- Create: `app/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `SA_COOKIE` de `@/lib/auth/restaurant-context`, `cerrarSesionRemota` de `@/app/actions/superadmin`, `getSupabaseAdmin` de `@/lib/supabase/admin`, `cookies` de `next/headers`

- [ ] **Step 1: Crear `app/dashboard/layout.tsx`**

```tsx
import { cookies } from 'next/headers'
import { SA_COOKIE } from '@/lib/auth/restaurant-context'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { cerrarSesionRemota } from '@/app/actions/superadmin'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const overrideId = cookieStore.get(SA_COOKIE)?.value

  let restaurantName: string | null = null
  if (overrideId) {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('restaurants')
      .select('name')
      .eq('id', overrideId)
      .single()
    restaurantName = data?.name ?? null
  }

  return (
    <>
      {overrideId && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm">
          <span className="text-amber-800 font-medium">
            Modo superadmin · Gestionando:{' '}
            <span className="font-bold">{restaurantName ?? overrideId}</span>
          </span>
          <form action={cerrarSesionRemota}>
            <button
              type="submit"
              className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-white transition-colors"
            >
              Salir
            </button>
          </form>
        </div>
      )}
      {children}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "feat(dashboard): add superadmin remote mode banner in layout"
```

---

### Task 5: Refactorizar `administracion.ts` y `cocina.ts`

**Files:**
- Modify: `app/actions/administracion.ts`
- Modify: `app/actions/cocina.ts`

**Interfaces:**
- Consumes: `getRestaurantContext` de `@/lib/auth/restaurant-context`

**Patrón de cambio** (aplica a ambos archivos):

1. Añadir import: `import { getRestaurantContext } from '@/lib/auth/restaurant-context'`
2. Eliminar la función `getRestaurantId` local completa (4-6 líneas)
3. En cada action, reemplazar el bloque de 4 líneas:
   ```ts
   // ANTES:
   const supabase = await createClient()
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) redirect('/login')
   const restaurantId = await getRestaurantId(supabase, user.id)
   if (!restaurantId) redirect('/login')
   ```
   por:
   ```ts
   // DESPUÉS:
   const ctx = await getRestaurantContext()
   if (!ctx) redirect('/login')
   const { supabase, restaurantId } = ctx
   ```
4. Eliminar el import de `createClient` si ya no se usa en el archivo (verificar antes de eliminar).

- [ ] **Step 1: Refactorizar `app/actions/administracion.ts`**

Añadir import:
```ts
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
```

Eliminar la función local (líneas 29-36):
```ts
// ELIMINAR ESTO:
async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, authId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', authId)
    .single()
  return data?.restaurant_id ?? null
}
```

Aplicar el patrón de cambio en las 4 funciones que usan `getRestaurantId`: `getReservasConfig`, `guardarReservasConfig`, `getMaxOnlineComensales`, `guardarAforoOnline`.

Verificar si `createClient` sigue usándose — en `administracion.ts` se usaba solo en las 4 funciones mencionadas, por lo que ya no es necesario. Eliminar el import `createClient`.

- [ ] **Step 2: Refactorizar `app/actions/cocina.ts`**

Añadir import:
```ts
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
```

Eliminar la función local (líneas 21-24):
```ts
// ELIMINAR ESTO:
async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('restaurant_id').eq('id', userId).single()
  return data?.restaurant_id ?? null
}
```

Aplicar el patrón de cambio en `getKitchenItems` y `updateKitchenItemStatus`.

Verificar si `createClient` sigue usándose — eliminar si no.

- [ ] **Step 3: Commit**

```bash
git add app/actions/administracion.ts app/actions/cocina.ts
git commit -m "refactor(actions): use getRestaurantContext in administracion and cocina"
```

---

### Task 6: Refactorizar `onboarding.ts` y `reservas.ts`

**Files:**
- Modify: `app/actions/onboarding.ts`
- Modify: `app/actions/reservas.ts`

**Interfaces:**
- Consumes: `getRestaurantContext` de `@/lib/auth/restaurant-context`

**Nota especial para `reservas.ts`:** Algunas actions usan `user.id` para campos de auditoría (`created_by`, `deleted_by`). Tras el refactor, usar `ctx.userId` en su lugar:
```ts
const ctx = await getRestaurantContext()
if (!ctx) redirect('/login')
const { supabase, restaurantId, userId } = ctx
// ...
created_by: userId,
deleted_by: userId,
```

- [ ] **Step 1: Refactorizar `app/actions/onboarding.ts`**

Añadir import:
```ts
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
```

Eliminar la función local `getRestaurantId` (líneas 62-72).

Aplicar el patrón de cambio en las 7 funciones que la usan: `getOnboardingData`, `guardarRestaurante`, `guardarZonasYMesas`, `guardarCarta`, `setOnboardingStep`, `completeOnboarding`, `resetOnboarding`.

Verificar si `createClient` sigue usándose y eliminar si no.

- [ ] **Step 2: Refactorizar `app/actions/reservas.ts`**

Añadir import:
```ts
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
```

Eliminar la función local `getRestaurantId` (líneas 60-70).

Aplicar el patrón de cambio en todas las functions. Para las que usan `user.id` para auditoría, usar `userId` del context:

Ejemplo en `createReservation`:
```ts
// ANTES:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
const restaurantId = await getRestaurantId(supabase, user.id)
if (!restaurantId) redirect('/login')
// ...
created_by: user.id,

// DESPUÉS:
const ctx = await getRestaurantContext()
if (!ctx) redirect('/login')
const { supabase, restaurantId, userId } = ctx
// ...
created_by: userId,
```

Aplicar la misma sustitución para `deleted_by: user.id` → `deleted_by: userId`.

- [ ] **Step 3: Commit**

```bash
git add app/actions/onboarding.ts app/actions/reservas.ts
git commit -m "refactor(actions): use getRestaurantContext in onboarding and reservas"
```

---

### Task 7: Refactorizar `productos.ts`

**Files:**
- Modify: `app/actions/productos.ts`

**Interfaces:**
- Consumes: `getRestaurantContext` de `@/lib/auth/restaurant-context`

**Nota especial:** `productos.ts` tiene una función `puedeEditar(supabase, userId)` que verifica si el usuario tiene rol admin o gerente. En modo superadmin, esta verificación se omite. El patrón para acciones con chequeo de permisos:

```ts
// ANTES:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
const restaurantId = await getRestaurantId(supabase, user.id)
if (!restaurantId) redirect('/login')
if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

// DESPUÉS:
const ctx = await getRestaurantContext()
if (!ctx) redirect('/login')
const { supabase, restaurantId, userId, isSuperadminMode } = ctx
if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }
```

Para acciones con campos de auditoría:
```ts
// ANTES:
created_by: user.id,
deleted_by: user.id,

// DESPUÉS:
created_by: userId,
deleted_by: userId,
```

- [ ] **Step 1: Añadir import en `app/actions/productos.ts`**

```ts
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
```

- [ ] **Step 2: Eliminar la función `getRestaurantId` local** (líneas 112-122 aproximadamente)

- [ ] **Step 3: Refactorizar todas las acciones** aplicando los dos patrones descritos arriba

Acciones que solo necesitan restaurantId (sin `puedeEditar`): `getProductos`, `getModificadores`, `getModificadoresParaProducto`.

Acciones con `puedeEditar` + auditoría: `crearCategoria`, `actualizarCategoria`, `crearProducto`, `actualizarProducto`, `eliminarProducto`, `crearGrupoModificador`, `actualizarGrupoModificador`, `eliminarGrupoModificador`, `crearOpcionModificador`, `actualizarOpcionModificador`, y todas las demás que usen `puedeEditar`.

- [ ] **Step 4: Commit**

```bash
git add app/actions/productos.ts
git commit -m "refactor(actions): use getRestaurantContext in productos (with superadmin bypass for puedeEditar)"
```

---

### Task 8: Refactorizar `tpv.ts`

**Files:**
- Modify: `app/actions/tpv.ts`

**Interfaces:**
- Consumes: `getRestaurantContext` de `@/lib/auth/restaurant-context`

**Nota especial:** `tpv.ts` usa `user.id` en muchos campos de auditoría: `opened_by`, `created_by`, `cancelled_by`, `closed_by`, `processed_by`. Todos se reemplazan por `userId` del context.

- [ ] **Step 1: Añadir import en `app/actions/tpv.ts`**

```ts
import { getRestaurantContext } from '@/lib/auth/restaurant-context'
```

- [ ] **Step 2: Eliminar la función `getRestaurantId` local** (líneas 90-100 aproximadamente)

- [ ] **Step 3: Refactorizar todas las acciones** con el patrón estándar

Sustituciones de auditoría:
- `opened_by: user.id` → `opened_by: userId`
- `created_by: user.id` → `created_by: userId`
- `cancelled_by: user.id` → `cancelled_by: userId`
- `closed_by: user.id` → `closed_by: userId`
- `processed_by: user.id` → `processed_by: userId`

Patrón para cada action:
```ts
const ctx = await getRestaurantContext()
if (!ctx) redirect('/login')
const { supabase, restaurantId, userId } = ctx
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/tpv.ts
git commit -m "refactor(actions): use getRestaurantContext in tpv"
```
