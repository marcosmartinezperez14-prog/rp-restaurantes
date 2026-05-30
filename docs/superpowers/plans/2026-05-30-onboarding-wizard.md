# Wizard de Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el sistema de onboarding completo para nuevos restaurantes: migración SQL, proxy de redirección, wizard de 4 pasos y server actions.

**Architecture:** El `proxy.ts` (Next.js 16) centraliza todos los redirects: usa la sesión Supabase para auth y una cookie `sb-onboarding=done` para detectar si el onboarding está completo. El wizard es un Client Component (`OnboardingWizard`) que recibe los datos del DB vía Server Component (`page.tsx`) y gestiona el paso activo con `useState`. Cada paso llama su Server Action que persiste el progreso en `restaurants.onboarding_step`.

**Tech Stack:** Next.js 16.2.6 · React 19 · TypeScript 5 strict · Tailwind v4 · @supabase/ssr v0.10.3 · @supabase/supabase-js v2

> **Nota sobre verificación:** Sin framework de tests. Verificación = `npx tsc --noEmit` por tarea. Verificación final = `npm run build`.

---

## File Map

| Fichero | Estado | Responsabilidad |
|---------|--------|----------------|
| `supabase/migrations/001_add_onboarding_fields.sql` | Crear | Añade columnas a `restaurants` |
| `proxy.ts` | Crear (raíz) | Redirección auth + onboarding |
| `app/actions/onboarding.ts` | Crear | Server Actions + tipos exportados |
| `app/onboarding/page.tsx` | Crear | Server Component: carga datos, guarda redirect si ya completado |
| `app/onboarding/OnboardingWizard.tsx` | Crear | `'use client'`: step state + indicador de progreso |
| `app/onboarding/Step1RestaurantData.tsx` | Crear | `'use client'`: formulario datos básicos |
| `app/onboarding/Step2ZonesAndTables.tsx` | Crear | `'use client'`: editor de zonas y mesas |
| `app/onboarding/Step3Menu.tsx` | Crear | `'use client'`: editor de categorías y productos |
| `app/onboarding/Step4Summary.tsx` | Crear | `'use client'`: resumen + botón completar |

---

## Task 1: Migración SQL

**Files:**
- Create: `supabase/migrations/001_add_onboarding_fields.sql`

- [ ] **Step 1: Crear directorio y fichero de migración**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"
New-Item -ItemType Directory -Force supabase/migrations
```

Crear `supabase/migrations/001_add_onboarding_fields.sql`:

```sql
-- Añade campos de onboarding y datos del restaurante a la tabla restaurants

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step      INT     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS address              TEXT,
  ADD COLUMN IF NOT EXISTS phone                TEXT,
  ADD COLUMN IF NOT EXISTS schedule             TEXT;
```

- [ ] **Step 2: Ejecutar la migración en Supabase**

Ve al Dashboard de Supabase → SQL Editor y ejecuta el contenido del fichero.
Verifica que la tabla `restaurants` ahora tiene las 5 columnas nuevas.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/001_add_onboarding_fields.sql
git commit -m "feat: add onboarding fields migration"
```

---

## Task 2: proxy.ts

**Files:**
- Create: `proxy.ts` (raíz del proyecto, mismo nivel que `package.json`)

- [ ] **Step 1: Verificar TypeScript limpio**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"
npx tsc --noEmit
```
Resultado esperado: sin errores.

- [ ] **Step 2: Crear `proxy.ts`**

```ts
// proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/registro']
const PUBLIC_PREFIXES = ['/r/', '/_next/', '/favicon']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas: dejar pasar siempre
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  // Crear cliente Supabase siguiendo el patrón oficial @supabase/ssr para proxy
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Obtener usuario (refresca el token si es necesario)
  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión → /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Sesión OK: comprobar si el onboarding está completado
  const onboardingDone = request.cookies.get('sb-onboarding')?.value === 'done'

  if (!onboardingDone && !pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)'],
}
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```
Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add proxy.ts
git commit -m "feat: add proxy with auth and onboarding redirect"
```

---

## Task 3: Server Actions de onboarding

**Files:**
- Create: `app/actions/onboarding.ts`

- [ ] **Step 1: Crear `app/actions/onboarding.ts`**

```ts
// app/actions/onboarding.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Tipos exportados (usados por los componentes del wizard) ─────────────────

export type ZoneInput = {
  id?: string
  name: string
  tables: { id?: string; number: number }[]
}

export type CategoryInput = {
  id?: string
  name: string
  products: { id?: string; name: string; price: number }[]
}

export type OnboardingData = {
  restaurant: {
    id: string
    name: string
    address: string | null
    phone: string | null
    schedule: string | null
    onboarding_step: number
    onboarding_completed: boolean
  }
  zones: ZoneInput[]
  categories: CategoryInput[]
}

type ActionResult = { error?: string } | undefined

// ─── Helper: obtener restaurant_id del usuario actual ────────────────────────

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

// ─── Acciones ────────────────────────────────────────────────────────────────

export async function getOnboardingData(): Promise<OnboardingData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, address, phone, schedule, onboarding_step, onboarding_completed')
    .eq('id', restaurantId)
    .single()

  const { data: zonesData } = await supabase
    .from('zones')
    .select('id, name')
    .eq('restaurant_id', restaurantId)

  const zoneIds = (zonesData ?? []).map(z => z.id)

  const { data: tablesData } = zoneIds.length > 0
    ? await supabase.from('tables').select('id, zone_id, number').in('zone_id', zoneIds)
    : { data: [] as { id: string; zone_id: string; number: number }[] }

  const { data: categoriesData } = await supabase
    .from('categories')
    .select('id, name')
    .eq('restaurant_id', restaurantId)

  const categoryIds = (categoriesData ?? []).map(c => c.id)

  const { data: productsData } = categoryIds.length > 0
    ? await supabase.from('products').select('id, category_id, name, price').in('category_id', categoryIds)
    : { data: [] as { id: string; category_id: string; name: string; price: number }[] }

  const zones: ZoneInput[] = (zonesData ?? []).map(z => ({
    id: z.id,
    name: z.name,
    tables: (tablesData ?? [])
      .filter(t => t.zone_id === z.id)
      .map(t => ({ id: t.id, number: t.number })),
  }))

  const categories: CategoryInput[] = (categoriesData ?? []).map(c => ({
    id: c.id,
    name: c.name,
    products: (productsData ?? [])
      .filter(p => p.category_id === c.id)
      .map(p => ({ id: p.id, name: p.name, price: p.price })),
  }))

  return { restaurant: restaurant!, zones, categories }
}

export async function saveRestaurantData(data: {
  name: string
  address: string
  phone: string
  schedule: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Ha ocurrido un error inesperado.' }

  if (!data.name.trim()) return { error: 'El nombre del restaurante es obligatorio.' }

  const { error } = await supabase
    .from('restaurants')
    .update({
      name: data.name.trim(),
      address: data.address.trim() || null,
      phone: data.phone.trim() || null,
      schedule: data.schedule.trim() || null,
      onboarding_step: 2,
    })
    .eq('id', restaurantId)

  if (error) return { error: 'Ha ocurrido un error al guardar los datos.' }
}

export async function saveZonesAndTables(zones: ZoneInput[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Ha ocurrido un error inesperado.' }

  if (zones.length === 0 || zones.some(z => z.tables.length === 0)) {
    return { error: 'Debe haber al menos 1 zona con 1 mesa.' }
  }

  // Obtener IDs existentes
  const { data: existingZones } = await supabase
    .from('zones')
    .select('id')
    .eq('restaurant_id', restaurantId)

  const existingZoneIds = (existingZones ?? []).map(z => z.id as string)
  const incomingZoneIds = zones.filter(z => z.id).map(z => z.id!)

  // Borrar zonas eliminadas (sus mesas se borran por CASCADE o manualmente)
  const zoneIdsToDelete = existingZoneIds.filter(id => !incomingZoneIds.includes(id))
  if (zoneIdsToDelete.length > 0) {
    await supabase.from('tables').delete().in('zone_id', zoneIdsToDelete)
    await supabase.from('zones').delete().in('id', zoneIdsToDelete)
  }

  // Upsert zonas y mesas
  for (const zone of zones) {
    let zoneId = zone.id
    if (zoneId) {
      await supabase.from('zones').update({ name: zone.name }).eq('id', zoneId)
    } else {
      const { data: newZone } = await supabase
        .from('zones')
        .insert({ restaurant_id: restaurantId, name: zone.name })
        .select('id')
        .single()
      zoneId = newZone?.id
    }
    if (!zoneId) continue

    // Mesas existentes de esta zona
    const { data: existingTables } = await supabase
      .from('tables')
      .select('id')
      .eq('zone_id', zoneId)
    const existingTableIds = (existingTables ?? []).map(t => t.id as string)
    const incomingTableIds = zone.tables.filter(t => t.id).map(t => t.id!)

    const tableIdsToDelete = existingTableIds.filter(id => !incomingTableIds.includes(id))
    if (tableIdsToDelete.length > 0) {
      await supabase.from('tables').delete().in('id', tableIdsToDelete)
    }

    for (const table of zone.tables) {
      if (table.id) {
        await supabase.from('tables').update({ number: table.number }).eq('id', table.id)
      } else {
        await supabase.from('tables').insert({ zone_id: zoneId, number: table.number })
      }
    }
  }

  await supabase.from('restaurants').update({ onboarding_step: 3 }).eq('id', restaurantId)
}

export async function saveMenuData(categories: CategoryInput[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Ha ocurrido un error inesperado.' }

  const totalProducts = categories.reduce((sum, c) => sum + c.products.length, 0)
  if (totalProducts === 0) return { error: 'Añade al menos 1 producto a tu carta.' }

  // Categorías existentes
  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id')
    .eq('restaurant_id', restaurantId)

  const existingCategoryIds = (existingCategories ?? []).map(c => c.id as string)
  const incomingCategoryIds = categories.filter(c => c.id).map(c => c.id!)

  const categoryIdsToDelete = existingCategoryIds.filter(id => !incomingCategoryIds.includes(id))
  if (categoryIdsToDelete.length > 0) {
    await supabase.from('products').delete().in('category_id', categoryIdsToDelete)
    await supabase.from('categories').delete().in('id', categoryIdsToDelete)
  }

  for (const category of categories) {
    let categoryId = category.id
    if (categoryId) {
      await supabase.from('categories').update({ name: category.name }).eq('id', categoryId)
    } else {
      const { data: newCategory } = await supabase
        .from('categories')
        .insert({ restaurant_id: restaurantId, name: category.name })
        .select('id')
        .single()
      categoryId = newCategory?.id
    }
    if (!categoryId) continue

    const { data: existingProducts } = await supabase
      .from('products')
      .select('id')
      .eq('category_id', categoryId)
    const existingProductIds = (existingProducts ?? []).map(p => p.id as string)
    const incomingProductIds = category.products.filter(p => p.id).map(p => p.id!)

    const productIdsToDelete = existingProductIds.filter(id => !incomingProductIds.includes(id))
    if (productIdsToDelete.length > 0) {
      await supabase.from('products').delete().in('id', productIdsToDelete)
    }

    for (const product of category.products) {
      if (product.id) {
        await supabase
          .from('products')
          .update({ name: product.name, price: product.price })
          .eq('id', product.id)
      } else {
        await supabase.from('products').insert({
          category_id: categoryId,
          name: product.name,
          price: product.price,
        })
      }
    }
  }

  await supabase.from('restaurants').update({ onboarding_step: 4 }).eq('id', restaurantId)
}

export async function completeOnboarding(): Promise<never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  await supabase
    .from('restaurants')
    .update({ onboarding_completed: true })
    .eq('id', restaurantId)

  const cookieStore = await cookies()
  cookieStore.set('sb-onboarding', 'done', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect('/dashboard')
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```
Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add app/actions/onboarding.ts
git commit -m "feat: add onboarding server actions"
```

---

## Task 4: page.tsx + OnboardingWizard.tsx

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `app/onboarding/OnboardingWizard.tsx`

- [ ] **Step 1: Crear `app/onboarding/page.tsx`**

```tsx
// app/onboarding/page.tsx
import { redirect } from 'next/navigation'
import { getOnboardingData } from '@/app/actions/onboarding'
import OnboardingWizard from './OnboardingWizard'

export default async function OnboardingPage() {
  const data = await getOnboardingData()

  if (data.restaurant.onboarding_completed) {
    redirect('/dashboard')
  }

  return <OnboardingWizard initialData={data} />
}
```

- [ ] **Step 2: Crear `app/onboarding/OnboardingWizard.tsx`**

```tsx
// app/onboarding/OnboardingWizard.tsx
'use client'

import { useState } from 'react'
import type { OnboardingData, ZoneInput, CategoryInput } from '@/app/actions/onboarding'
import Step1RestaurantData from './Step1RestaurantData'
import Step2ZonesAndTables from './Step2ZonesAndTables'
import Step3Menu from './Step3Menu'
import Step4Summary from './Step4Summary'

interface Props {
  initialData: OnboardingData
}

const STEP_NAMES = ['Restaurante', 'Zonas', 'Carta', '¡Listo!']

export default function OnboardingWizard({ initialData }: Props) {
  const [step, setStep] = useState(
    Math.min(Math.max(initialData.restaurant.onboarding_step, 1), 4)
  )
  const [data, setData] = useState<OnboardingData>(initialData)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <p className="text-center text-sm text-gray-500 mb-6">RP Restaurantes</p>

        {/* Indicador de progreso */}
        <div className="flex items-center justify-center mb-8">
          {STEP_NAMES.map((name, i) => {
            const stepNum = i + 1
            const isActive = stepNum === step
            const isCompleted = stepNum < step
            return (
              <div key={stepNum} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive || isCompleted
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {isCompleted ? '✓' : stepNum}
                  </div>
                  <span
                    className={`text-xs mt-1 whitespace-nowrap ${
                      isActive ? 'text-blue-600 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {name}
                  </span>
                </div>
                {i < STEP_NAMES.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mb-5 mx-1 ${
                      stepNum < step ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Contenido del paso */}
        <div className="bg-white rounded-2xl shadow-md p-8">
          {step === 1 && (
            <Step1RestaurantData
              restaurant={data.restaurant}
              onNext={(updated) => {
                setData(d => ({
                  ...d,
                  restaurant: { ...d.restaurant, ...updated, onboarding_step: 2 },
                }))
                setStep(2)
              }}
            />
          )}
          {step === 2 && (
            <Step2ZonesAndTables
              zones={data.zones}
              onNext={(zones: ZoneInput[]) => {
                setData(d => ({ ...d, zones }))
                setStep(3)
              }}
            />
          )}
          {step === 3 && (
            <Step3Menu
              categories={data.categories}
              onNext={(categories: CategoryInput[]) => {
                setData(d => ({ ...d, categories }))
                setStep(4)
              }}
            />
          )}
          {step === 4 && <Step4Summary data={data} />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```
Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add app/onboarding/page.tsx app/onboarding/OnboardingWizard.tsx
git commit -m "feat: add onboarding page and wizard shell"
```

---

## Task 5: Step1RestaurantData.tsx

**Files:**
- Create: `app/onboarding/Step1RestaurantData.tsx`

- [ ] **Step 1: Crear `app/onboarding/Step1RestaurantData.tsx`**

```tsx
// app/onboarding/Step1RestaurantData.tsx
'use client'

import { useState, useTransition } from 'react'
import { saveRestaurantData } from '@/app/actions/onboarding'

interface Props {
  restaurant: {
    name: string
    address: string | null
    phone: string | null
    schedule: string | null
  }
  onNext: (updated: {
    name: string
    address: string
    phone: string
    schedule: string
  }) => void
}

export default function Step1RestaurantData({ restaurant, onNext }: Props) {
  const [name, setName] = useState(restaurant.name)
  const [address, setAddress] = useState(restaurant.address ?? '')
  const [phone, setPhone] = useState(restaurant.phone ?? '')
  const [schedule, setSchedule] = useState(restaurant.schedule ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('El nombre del restaurante es obligatorio.')
      return
    }
    startTransition(async () => {
      const result = await saveRestaurantData({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        schedule: schedule.trim(),
      })
      if (result?.error) {
        setError(result.error)
      } else {
        onNext({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          schedule: schedule.trim(),
        })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Datos del restaurante</h2>

      <div>
        <label htmlFor="ob-name" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del restaurante
        </label>
        <input
          id="ob-name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="ob-address" className="block text-sm font-medium text-gray-700 mb-1">
          Dirección
        </label>
        <input
          id="ob-address"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Calle Mayor 1, Madrid"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="ob-phone" className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono
        </label>
        <input
          id="ob-phone"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="91 123 45 67"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="ob-schedule" className="block text-sm font-medium text-gray-700 mb-1">
          Horario
        </label>
        <input
          id="ob-schedule"
          value={schedule}
          onChange={e => setSchedule(e.target.value)}
          placeholder="Lun-Vie 12:00-23:00"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Guardando...' : 'Guardar y continuar →'}
      </button>
    </form>
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
git add app/onboarding/Step1RestaurantData.tsx
git commit -m "feat: add onboarding step 1 (restaurant data)"
```

---

## Task 6: Step2ZonesAndTables.tsx

**Files:**
- Create: `app/onboarding/Step2ZonesAndTables.tsx`

- [ ] **Step 1: Crear `app/onboarding/Step2ZonesAndTables.tsx`**

```tsx
// app/onboarding/Step2ZonesAndTables.tsx
'use client'

import { useState, useTransition } from 'react'
import { saveZonesAndTables, type ZoneInput } from '@/app/actions/onboarding'

interface Props {
  zones: ZoneInput[]
  onNext: (zones: ZoneInput[]) => void
}

export default function Step2ZonesAndTables({ zones: initialZones, onNext }: Props) {
  const [zones, setZones] = useState<ZoneInput[]>(initialZones)
  const [editingZoneIdx, setEditingZoneIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const addZone = () => {
    setZones(z => [...z, { name: 'Nueva zona', tables: [{ number: 1 }] }])
  }

  const removeZone = (idx: number) => {
    if (zones.length <= 1) return
    setZones(z => z.filter((_, i) => i !== idx))
  }

  const updateZoneName = (idx: number, name: string) => {
    setZones(z => z.map((zone, i) => (i === idx ? { ...zone, name } : zone)))
  }

  const addTable = (zoneIdx: number) => {
    setZones(z =>
      z.map((zone, i) => {
        if (i !== zoneIdx) return zone
        const nextNum = Math.max(0, ...zone.tables.map(t => t.number)) + 1
        return { ...zone, tables: [...zone.tables, { number: nextNum }] }
      })
    )
  }

  const removeTable = (zoneIdx: number, tableIdx: number) => {
    setZones(z =>
      z.map((zone, i) => {
        if (i !== zoneIdx) return zone
        if (zone.tables.length <= 1) return zone
        return { ...zone, tables: zone.tables.filter((_, ti) => ti !== tableIdx) }
      })
    )
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveZonesAndTables(zones)
      if (result?.error) {
        setError(result.error)
      } else {
        onNext(zones)
      }
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Zonas y mesas</h2>
      <p className="text-sm text-gray-600 mb-4">
        Revisa y personaliza las zonas y mesas de tu restaurante.
      </p>

      {zones.map((zone, zoneIdx) => (
        <div key={zoneIdx} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            {editingZoneIdx === zoneIdx ? (
              <input
                autoFocus
                value={zone.name}
                onChange={e => updateZoneName(zoneIdx, e.target.value)}
                onBlur={() => setEditingZoneIdx(null)}
                className="flex-1 border border-blue-400 rounded px-2 py-1 text-gray-900 text-sm focus:outline-none"
              />
            ) : (
              <span className="font-medium text-gray-900 flex-1">{zone.name}</span>
            )}
            <button
              type="button"
              onClick={() => setEditingZoneIdx(zoneIdx)}
              className="text-gray-400 hover:text-blue-600 px-2 text-sm"
              title="Renombrar zona"
            >
              ✎
            </button>
            {zones.length > 1 && (
              <button
                type="button"
                onClick={() => removeZone(zoneIdx)}
                className="text-gray-400 hover:text-red-500 px-2 text-sm"
                title="Eliminar zona"
              >
                🗑
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {zone.tables.map((table, tableIdx) => (
              <div
                key={tableIdx}
                className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm text-gray-800"
              >
                Mesa {table.number}
                {zone.tables.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTable(zoneIdx, tableIdx)}
                    className="text-gray-400 hover:text-red-500 ml-1 leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addTable(zoneIdx)}
              className="bg-blue-50 text-blue-600 rounded-full px-3 py-1 text-sm hover:bg-blue-100"
            >
              + mesa
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addZone}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-sm transition-colors"
      >
        + Añadir zona
      </button>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Guardando...' : 'Guardar y continuar →'}
      </button>
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
git add app/onboarding/Step2ZonesAndTables.tsx
git commit -m "feat: add onboarding step 2 (zones and tables)"
```

---

## Task 7: Step3Menu.tsx

**Files:**
- Create: `app/onboarding/Step3Menu.tsx`

- [ ] **Step 1: Crear `app/onboarding/Step3Menu.tsx`**

```tsx
// app/onboarding/Step3Menu.tsx
'use client'

import { useState, useTransition } from 'react'
import { saveMenuData, type CategoryInput } from '@/app/actions/onboarding'

interface Props {
  categories: CategoryInput[]
  onNext: (categories: CategoryInput[]) => void
}

export default function Step3Menu({ categories: initialCategories, onNext }: Props) {
  const [categories, setCategories] = useState<CategoryInput[]>(initialCategories)
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const addCategory = () => {
    setCategories(c => [...c, { name: 'Nueva categoría', products: [] }])
  }

  const removeCategory = (idx: number) => {
    setCategories(c => c.filter((_, i) => i !== idx))
  }

  const updateCategoryName = (idx: number, name: string) => {
    setCategories(c => c.map((cat, i) => (i === idx ? { ...cat, name } : cat)))
  }

  const addProduct = (catIdx: number) => {
    setCategories(c =>
      c.map((cat, i) => {
        if (i !== catIdx) return cat
        return { ...cat, products: [...cat.products, { name: 'Nuevo producto', price: 0 }] }
      })
    )
  }

  const removeProduct = (catIdx: number, prodIdx: number) => {
    setCategories(c =>
      c.map((cat, i) => {
        if (i !== catIdx) return cat
        return { ...cat, products: cat.products.filter((_, pi) => pi !== prodIdx) }
      })
    )
  }

  const updateProduct = (
    catIdx: number,
    prodIdx: number,
    field: 'name' | 'price',
    value: string
  ) => {
    setCategories(c =>
      c.map((cat, i) => {
        if (i !== catIdx) return cat
        return {
          ...cat,
          products: cat.products.map((p, pi) => {
            if (pi !== prodIdx) return p
            return field === 'price'
              ? { ...p, price: parseFloat(value) || 0 }
              : { ...p, name: value }
          }),
        }
      })
    )
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveMenuData(categories)
      if (result?.error) {
        setError(result.error)
      } else {
        onNext(categories)
      }
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Tu carta</h2>
      <p className="text-sm text-gray-600 mb-4">
        Revisa y personaliza las categorías y productos de tu carta.
      </p>

      {categories.map((cat, catIdx) => (
        <div key={catIdx} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            {editingCatIdx === catIdx ? (
              <input
                autoFocus
                value={cat.name}
                onChange={e => updateCategoryName(catIdx, e.target.value)}
                onBlur={() => setEditingCatIdx(null)}
                className="flex-1 border border-blue-400 rounded px-2 py-1 text-gray-900 text-sm focus:outline-none"
              />
            ) : (
              <span className="font-medium text-gray-900 flex-1">{cat.name}</span>
            )}
            <button
              type="button"
              onClick={() => setEditingCatIdx(catIdx)}
              className="text-gray-400 hover:text-blue-600 px-2 text-sm"
              title="Renombrar categoría"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => removeCategory(catIdx)}
              className="text-gray-400 hover:text-red-500 px-2 text-sm"
              title="Eliminar categoría"
            >
              🗑
            </button>
          </div>

          <div className="space-y-2">
            {cat.products.map((prod, prodIdx) => (
              <div key={prodIdx} className="flex items-center gap-2">
                <input
                  value={prod.name}
                  onChange={e => updateProduct(catIdx, prodIdx, 'name', e.target.value)}
                  placeholder="Nombre del producto"
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center border border-gray-300 rounded px-2 py-1 w-24">
                  <input
                    type="number"
                    value={prod.price}
                    onChange={e => updateProduct(catIdx, prodIdx, 'price', e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full text-gray-900 text-sm focus:outline-none"
                  />
                  <span className="text-gray-500 text-sm ml-1">€</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeProduct(catIdx, prodIdx)}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addProduct(catIdx)}
              className="text-blue-600 hover:underline text-sm"
            >
              + Añadir producto
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addCategory}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-sm transition-colors"
      >
        + Añadir categoría
      </button>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Guardando...' : 'Guardar y continuar →'}
      </button>
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
git add app/onboarding/Step3Menu.tsx
git commit -m "feat: add onboarding step 3 (menu)"
```

---

## Task 8: Step4Summary.tsx

**Files:**
- Create: `app/onboarding/Step4Summary.tsx`

- [ ] **Step 1: Crear `app/onboarding/Step4Summary.tsx`**

```tsx
// app/onboarding/Step4Summary.tsx
'use client'

import { useTransition } from 'react'
import { completeOnboarding, type OnboardingData } from '@/app/actions/onboarding'

interface Props {
  data: OnboardingData
}

export default function Step4Summary({ data }: Props) {
  const [isPending, startTransition] = useTransition()

  const totalTables = data.zones.reduce((sum, z) => sum + z.tables.length, 0)
  const totalProducts = data.categories.reduce((sum, c) => sum + c.products.length, 0)

  const handleComplete = () => {
    startTransition(async () => {
      await completeOnboarding()
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-xl font-bold text-gray-900">¡Todo listo!</h2>
        <p className="text-gray-600 text-sm mt-1">
          Aquí tienes un resumen de tu configuración.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <span className="text-green-600 font-bold">✓</span>
          <div>
            <p className="text-sm font-medium text-gray-900">Restaurante</p>
            <p className="text-sm text-gray-600">{data.restaurant.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <span className="text-green-600 font-bold">✓</span>
          <div>
            <p className="text-sm font-medium text-gray-900">Zonas y mesas</p>
            <p className="text-sm text-gray-600">
              {data.zones.length} zona{data.zones.length !== 1 ? 's' : ''} · {totalTables} mesa{totalTables !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <span className="text-green-600 font-bold">✓</span>
          <div>
            <p className="text-sm font-medium text-gray-900">Carta</p>
            <p className="text-sm text-gray-600">
              {data.categories.length} categoría{data.categories.length !== 1 ? 's' : ''} · {totalProducts} producto{totalProducts !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleComplete}
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors text-lg"
      >
        {isPending ? 'Configurando...' : 'Empezar a usar el sistema'}
      </button>
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
git add app/onboarding/Step4Summary.tsx
git commit -m "feat: add onboarding step 4 (summary and complete)"
```

---

## Task 9: Verificación final de build

- [ ] **Step 1: Build de producción**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"
npm run build
```

Resultado esperado: sin errores. Verás entre las rutas:
```
○ /onboarding
ƒ /dashboard
○ /login
○ /registro
```

Si el build falla con error de tipos, corrige el fichero indicado antes de continuar.

- [ ] **Step 2: Verificar flujo completo en desarrollo**

```powershell
npm run dev
```

Verificaciones:

| Acción | Resultado esperado |
|--------|--------------------|
| Ir a `/dashboard` sin sesión | Redirige a `/login` |
| Ir a `/dashboard` con sesión nueva (sin cookie `sb-onboarding`) | Redirige a `/onboarding` |
| `/onboarding` muestra el indicador de 4 pasos | Paso 1 activo en azul |
| Rellenar Paso 1 y pulsar "Guardar y continuar" | Avanza a Paso 2 |
| Cerrar y volver a `/onboarding` | Retoma en el último paso guardado |
| Completar Paso 4 y pulsar "Empezar a usar el sistema" | Redirige a `/dashboard` |
| Volver a `/onboarding` tras completar | Redirige a `/dashboard` |

- [ ] **Step 3: Commit final si hubieron fixes**

```powershell
git add -A
git commit -m "fix: resolve build issues from onboarding"
```
(Solo si se aplicaron correcciones en este paso.)

---

## Self-Review

### Spec coverage

| Requisito | Tarea |
|-----------|-------|
| `onboarding_completed BOOLEAN` + `onboarding_step INT` en `restaurants` | Task 1 |
| `address`, `phone`, `schedule` en `restaurants` | Task 1 |
| `proxy.ts` — sin sesión → `/login` | Task 2 |
| `proxy.ts` — sin cookie → `/onboarding` (salvo rutas públicas) | Task 2 |
| `proxy.ts` — rutas públicas `/login`, `/registro`, `/r/` | Task 2 |
| `getOnboardingData()` con datos anidados | Task 3 |
| `saveRestaurantData()` → avanza step a 2 | Task 3 |
| `saveZonesAndTables()` → validación 1 zona/1 mesa, upsert+delete, step a 3 | Task 3 |
| `saveMenuData()` → validación 1 producto, upsert+delete, step a 4 | Task 3 |
| `completeOnboarding()` → `onboarding_completed=TRUE` + cookie + redirect | Task 3 |
| `page.tsx` redirect si `onboarding_completed=true` | Task 4 |
| `OnboardingWizard` con indicador de progreso 4 pasos | Task 4 |
| Paso 1 — formulario 4 campos pre-rellenados | Task 5 |
| Paso 2 — editor zonas/mesas inline | Task 6 |
| Paso 3 — editor categorías/productos inline | Task 7 |
| Paso 4 — resumen + botón completar | Task 8 |
| Reanudación del paso correcto al volver | Task 4 (`initialStep = onboarding_step`) |
| Diseño coherente con login/registro | Tasks 4-8 (misma paleta) |
| TypeScript sin `any` | Todas las tareas |

### Tipos consistentes entre tareas

- `ZoneInput`, `CategoryInput`, `OnboardingData`, `ActionResult` — definidos en Task 3, importados en Tasks 4-8
- `saveRestaurantData` acepta `{ name, address, phone, schedule }` — coincide con Step1 Task 5
- `saveZonesAndTables(zones: ZoneInput[])` — coincide con Step2 Task 6
- `saveMenuData(categories: CategoryInput[])` — coincide con Step3 Task 7
- `completeOnboarding(): Promise<never>` — usado en Step4 Task 8 vía `startTransition`
