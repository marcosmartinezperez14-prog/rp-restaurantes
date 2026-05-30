# Wizard de Onboarding — Diseño

**Fecha:** 2026-05-30  
**Proyecto:** RP Restaurantes  
**Stack:** Next.js 16.2.6 · React 19 · TypeScript · Tailwind v4 · Supabase SSR

---

## Alcance

Crear el sistema de onboarding completo para nuevos restaurantes:

1. Migración SQL con campos nuevos en `restaurants`
2. `proxy.ts` con lógica de redirección centralizada (auth + onboarding)
3. Wizard de 4 pasos en `/onboarding`
4. Server Actions en `app/actions/onboarding.ts`

No se tocan `lib/supabase/server.ts` ni `app/actions/auth.ts`.

---

## Esquema de base de datos

### Tablas existentes (creadas por trigger al registrarse)

```
restaurants   id, name, slug, nif, ...
zones         id, restaurant_id, name
tables        id, zone_id, number
categories    id, restaurant_id, name
products      id, category_id, name, price
users         id, restaurant_id, ...
```

### Migración: `supabase/migrations/001_add_onboarding_fields.sql`

```sql
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step      INT     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS address              TEXT,
  ADD COLUMN IF NOT EXISTS phone                TEXT,
  ADD COLUMN IF NOT EXISTS schedule             TEXT;
```

- `onboarding_step`: 1–4, persiste el paso actual; arranca en 1
- `onboarding_completed`: FALSE hasta que el usuario pulsa "Empezar a usar el sistema"
- `address`, `phone`, `schedule`: recogidos en el Paso 1

**Ejecución:** manual en Supabase Dashboard → SQL Editor, o `supabase db push`.

---

## Arquitectura y ficheros

```
supabase/
  migrations/
    001_add_onboarding_fields.sql
proxy.ts                              ← nuevo (raíz del proyecto)
app/
  actions/
    onboarding.ts                     ← nuevo: Server Actions del wizard
  onboarding/
    page.tsx                          ← Server Component: carga datos, pasa step al wizard
    OnboardingWizard.tsx              ← 'use client': gestiona paso activo + indicador progreso
    Step1RestaurantData.tsx           ← 'use client': formulario datos del restaurante
    Step2ZonesAndTables.tsx           ← 'use client': editor de zonas y mesas
    Step3Menu.tsx                     ← 'use client': editor de categorías y productos
    Step4Summary.tsx                  ← 'use client': resumen + botón completar
```

### Flujo de datos

```
Usuario → /dashboard
  → proxy.ts: sin sesión → /login
  → proxy.ts: sesión OK, sin cookie sb-onboarding → /onboarding
  → proxy.ts: sesión OK, cookie sb-onboarding=done → /dashboard ✓

/onboarding
  → page.tsx (Server Component): getOnboardingData() → { restaurant, zones, categories }
  → <OnboardingWizard initialStep={restaurant.onboarding_step} data={...}>
      → renderiza Step1 | Step2 | Step3 | Step4 según el paso activo
      → cada paso llama su Server Action → BD actualizada → avanza al siguiente paso

Paso 4 → completeOnboarding()
  → onboarding_completed = TRUE
  → cookie sb-onboarding=done (httpOnly, path=/)
  → redirect('/dashboard')
```

---

## `proxy.ts`

Fichero en la raíz del proyecto. Exporta función `proxy` (Next.js 16 — `middleware` está deprecado).

```ts
// proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/registro']
const PUBLIC_PREFIX = ['/r/']   // carta pública

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas: siempre dejar pasar
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIX.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  // Crear cliente Supabase para proxy (refresca cookies de sesión)
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión → /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Sesión OK: comprobar onboarding
  const onboardingDone = request.cookies.get('sb-onboarding')?.value === 'done'

  if (!onboardingDone && !pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

**Nota sobre el cookie `sb-onboarding`:** está ausente en cuentas nuevas (→ redirect a onboarding). Lo escribe `completeOnboarding()` server-side con `httpOnly: true, path: '/', sameSite: 'lax'`.

---

## Server Actions — `app/actions/onboarding.ts`

`'use server'` a nivel de módulo. Todas verifican sesión antes de operar.

### Tipos

```ts
type ZoneInput = {
  id?: string
  name: string
  tables: { id?: string; number: number }[]
}

type CategoryInput = {
  id?: string
  name: string
  products: { id?: string; name: string; price: number }[]
}

type OnboardingData = {
  restaurant: {
    id: string
    name: string
    address: string | null
    phone: string | null
    schedule: string | null
    onboarding_step: number
  }
  zones: ZoneInput[]
  categories: CategoryInput[]
}

type ActionResult = { error?: string } | undefined
```

### `getOnboardingData(): Promise<OnboardingData>`

- `supabase.auth.getUser()` → si no hay usuario → `redirect('/login')`
- `SELECT restaurant_id FROM users WHERE id = {user.id}` → obtener el restaurant del usuario
- `SELECT * FROM restaurants WHERE id = {restaurant_id}`
- `SELECT * FROM zones WHERE restaurant_id = {restaurant_id}`
- `SELECT * FROM tables WHERE zone_id IN ({zone_ids})`
- `SELECT * FROM categories WHERE restaurant_id = {restaurant_id}`
- `SELECT * FROM products WHERE category_id IN ({category_ids})`
- Devuelve `OnboardingData` con zonas anidando sus mesas y categorías anidando sus productos

### `saveRestaurantData(data: { name: string; address: string; phone: string; schedule: string }): Promise<ActionResult>`

- Verificar usuario
- `UPDATE restaurants SET name=?, address=?, phone=?, schedule=?, onboarding_step=2 WHERE id=?`
- Devuelve `undefined` en éxito, `{ error }` si falla

### `saveZonesAndTables(zones: ZoneInput[]): Promise<ActionResult>`

- Verificar usuario
- Validar: `zones.length >= 1` y cada zona tiene `tables.length >= 1` → si no, `{ error: 'Debe haber al menos 1 zona con 1 mesa.' }`
- Para cada zona con `id`: `UPDATE zones SET name=?`; sin `id`: `INSERT INTO zones`
- Para cada mesa con `id`: `UPDATE tables SET number=?`; sin `id`: `INSERT INTO tables`
- Borrar zonas eliminadas (las que estaban en BD pero no en el array recibido)
- Borrar mesas eliminadas
- `UPDATE restaurants SET onboarding_step=3`
- Devuelve `undefined` en éxito

### `saveMenuData(categories: CategoryInput[]): Promise<ActionResult>`

- Verificar usuario
- Validar: al menos 1 producto en total → si no, `{ error: 'Añade al menos 1 producto.' }`
- Upsert categorías y productos (igual que zonas/mesas)
- Borrar categorías y productos eliminados
- `UPDATE restaurants SET onboarding_step=4`
- Devuelve `undefined` en éxito

### `completeOnboarding(): Promise<never>`

- Verificar usuario
- `UPDATE restaurants SET onboarding_completed=TRUE`
- Escribir cookie `sb-onboarding=done` vía `cookies()` de `next/headers`
- `redirect('/dashboard')`

---

## UI del Wizard

### Indicador de progreso (compartido)

4 pasos con círculos y líneas conectoras:

```
● ── ○ ── ○ ── ○
1    2    3    4
Restaurante  Zonas  Carta  ¡Listo!
```

- Azul sólido (`bg-blue-600`): paso activo y completados
- Gris (`bg-gray-300`): pendientes
- Paso actual muestra el nombre destacado

### Layout

- Fondo: `bg-gray-50 min-h-screen`
- Tarjeta: `max-w-2xl mx-auto bg-white rounded-2xl shadow-md p-8`
- "RP Restaurantes" en pequeño arriba, igual que login/registro

### Paso 1 — Datos del restaurante

Campos pre-rellenados con valores actuales:

| Campo | Tipo | Placeholder |
|-------|------|-------------|
| Nombre del restaurante | text | Mi Restaurante |
| Dirección | text | Calle Mayor 1, Madrid |
| Teléfono | text | 91 123 45 67 |
| Horario | text | Lun-Vie 12:00-23:00 |

Botón: `Guardar y continuar →` (loading + disabled mientras pending)

### Paso 2 — Zonas y mesas

Cada zona muestra sus mesas como chips. Interacciones:

- **Renombrar zona:** clic en ✎ → input inline → blur guarda localmente
- **Eliminar zona:** clic en 🗑 (solo si hay más de 1 zona)
- **Añadir mesa:** `+ mesa` → añade chip con número auto-incremental
- **Eliminar mesa:** clic en × en el chip (solo si hay más de 1 mesa en la zona)
- **Añadir zona:** botón `+ Añadir zona` al final
- Mensaje de error en rojo si intenta guardar con validación fallida

Botón: `Guardar y continuar →`

### Paso 3 — Tu carta

Misma mecánica que Paso 2 pero para categorías y productos:

- Cada producto tiene: nombre (input inline) + precio (input numérico)
- Al menos 1 producto para poder avanzar

Botón: `Guardar y continuar →`

### Paso 4 — ¡Todo listo!

Tarjeta de resumen sin inputs:

```
✓ Restaurante: "La Tasca"
✓ Zonas: 2 zonas · 8 mesas
✓ Carta: 3 categorías · 12 productos
```

Botón primario: `Empezar a usar el sistema`
→ Llama `completeOnboarding()` → redirect `/dashboard`

---

## Manejo de errores

| Situación | Respuesta |
|-----------|-----------|
| Sin sesión en cualquier acción | `redirect('/login')` |
| 0 zonas o zona sin mesas | `'Debe haber al menos 1 zona con 1 mesa.'` |
| 0 productos | `'Añade al menos 1 producto a tu carta.'` |
| Error de BD inesperado | `'Ha ocurrido un error. Inténtalo de nuevo.'` |
| Usuario vuelve a /onboarding con onboarding_completed=TRUE | Redirigir a /dashboard (comprobar en page.tsx) |

---

## Consideraciones técnicas

- **Next.js 16:** `proxy.ts` en raíz, función exportada como `proxy` (no `middleware`)
- **Edge Runtime:** el proxy solo lee cookies y la sesión JWT de Supabase — sin queries a BD. El patrón de cookies en `proxy.ts` sigue el esquema oficial de `@supabase/ssr` para proxy/middleware: `getAll` desde `request.cookies`, `setAll` muteando tanto `request` como `response` para propagación correcta del token refrescado.
- **Cookie `sb-onboarding`:** escrita con `httpOnly: true` desde Server Action via `cookies()` de `next/headers`; el proxy la lee via `request.cookies`
- **Reanudación:** `onboarding_step` en BD garantiza que si el usuario cierra y vuelve, `page.tsx` carga el paso correcto como `initialStep`
- **Server Actions con datos complejos:** `saveZonesAndTables` y `saveMenuData` reciben arrays de objetos (no FormData) — llamadas programáticamente desde Client Components, no como `form action`
- **TypeScript strict:** sin `any`. Los tipos de Supabase se usan directamente para los resultados de query
- **Tailwind v4:** sin `tailwind.config.js`, clases estándar
