# Panel "Mi Negocio" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la página `/dashboard/negocio` con KPIs del día (ingresos, pedidos, mesas, producto estrella) y actividad reciente, con refresco automático cada 60 s, optimizada para móvil, solo accesible para rol `admin`.

**Architecture:** Dos funciones SQL RPC en Supabase calculan los datos sin parámetros (usan `CURRENT_DATE`). Una API Route GET las despacha. Una página Server Component verifica sesión y rol `admin`. Un Client Component maneja fetches paralelos, auto-refresh y UI mobile-first.

**Tech Stack:** Next.js 16 App Router, Supabase (RPC), TypeScript, Tailwind CSS

---

## Columnas confirmadas (NO inventar otras)

- `orders.total` (NO `total_amount`)
- `orders.updated_at` (NO `closed_at`) — se usa como timestamp de cierre cuando `status = 'paid'`
- `orders.status` valores reales: `'open' | 'paid' | 'cancelled'`
- `orders.table_id` — FK a `tables.id`
- `tables.status` valores reales: `'free' | 'occupied' | 'reserved' | 'billing'`
- `tables.name` — nombre de la mesa

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|---|---|---|
| MANUAL | Supabase SQL editor | 2 RPCs: `get_resumen_hoy` + `get_actividad_reciente` |
| CREAR | `types/negocio.ts` | Tipos TypeScript |
| CREAR | `app/api/negocio/route.ts` | Route Handler GET — despacha las 2 RPCs |
| CREAR | `app/dashboard/negocio/page.tsx` | Server Component — auth + guard rol admin |
| CREAR | `components/negocio/NegocioMovil.tsx` | Client Component — UI completa + auto-refresh |
| MODIFICAR | `app/dashboard/page.tsx` | Añadir tarjeta "Mi negocio" a NAV_CARDS |
| MODIFICAR | `components/NavDrawer.tsx` | Añadir enlace "Mi negocio" a NAV_ITEMS |

---

## Task 1: SQL RPCs en Supabase (paso manual)

**Archivos:** ninguno — SQL a ejecutar en Supabase → SQL Editor

- [ ] **Step 1: Crear función get_resumen_hoy**

```sql
CREATE OR REPLACE FUNCTION get_resumen_hoy()
RETURNS TABLE (
  ingresos_hoy      NUMERIC,
  pedidos_cerrados  BIGINT,
  ticket_medio      NUMERIC,
  mesas_ocupadas    BIGINT,
  mesas_totales     BIGINT,
  producto_estrella TEXT,
  ingresos_ayer     NUMERIC
)
LANGUAGE sql STABLE AS $$
  WITH hoy AS (
    SELECT
      COALESCE(SUM(o.total), 0) AS ingresos_hoy,
      COUNT(o.id)                AS pedidos_cerrados,
      COALESCE(AVG(o.total), 0) AS ticket_medio
    FROM orders o
    WHERE o.restaurant_id = get_current_restaurant_id()
      AND o.status = 'paid'
      AND o.updated_at >= CURRENT_DATE
      AND o.updated_at < CURRENT_DATE + INTERVAL '1 day'
  ),
  ayer AS (
    SELECT COALESCE(SUM(total), 0) AS ingresos_ayer
    FROM orders
    WHERE restaurant_id = get_current_restaurant_id()
      AND status = 'paid'
      AND updated_at >= CURRENT_DATE - INTERVAL '1 day'
      AND updated_at < CURRENT_DATE
  ),
  mesas AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'occupied') AS mesas_ocupadas,
      COUNT(*)                                     AS mesas_totales
    FROM tables
    WHERE restaurant_id = get_current_restaurant_id()
  ),
  estrella AS (
    SELECT p.name AS producto_estrella
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.restaurant_id = get_current_restaurant_id()
      AND o.status = 'paid'
      AND o.updated_at >= CURRENT_DATE
    GROUP BY p.name
    ORDER BY SUM(oi.quantity) DESC
    LIMIT 1
  )
  SELECT
    hoy.ingresos_hoy,
    hoy.pedidos_cerrados,
    hoy.ticket_medio,
    mesas.mesas_ocupadas,
    mesas.mesas_totales,
    COALESCE(estrella.producto_estrella, '—'),
    ayer.ingresos_ayer
  FROM hoy, ayer, mesas
  LEFT JOIN estrella ON true;
$$;

GRANT EXECUTE ON FUNCTION get_resumen_hoy TO authenticated;
```

- [ ] **Step 2: Crear función get_actividad_reciente**

```sql
CREATE OR REPLACE FUNCTION get_actividad_reciente()
RETURNS TABLE (
  pedido_id   UUID,
  mesa_nombre TEXT,
  total       NUMERIC,
  cerrado_at  TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
  SELECT
    o.id                            AS pedido_id,
    COALESCE(t.name, 'Para llevar') AS mesa_nombre,
    o.total                         AS total,
    o.updated_at                    AS cerrado_at
  FROM orders o
  LEFT JOIN tables t ON t.id = o.table_id
  WHERE o.restaurant_id = get_current_restaurant_id()
    AND o.status = 'paid'
    AND o.updated_at >= CURRENT_DATE
  ORDER BY o.updated_at DESC
  LIMIT 8;
$$;

GRANT EXECUTE ON FUNCTION get_actividad_reciente TO authenticated;
```

- [ ] **Step 3: Verificar que las 2 funciones existen**

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_resumen_hoy', 'get_actividad_reciente');
```

Resultado esperado: 2 filas.

---

## Task 2: Tipos TypeScript

**Archivos:**
- Crear: `types/negocio.ts`

- [ ] **Step 1: Crear el archivo de tipos**

Crear `types/negocio.ts`:

```typescript
export interface ResumenHoy {
  ingresos_hoy: number
  pedidos_cerrados: number
  ticket_medio: number
  mesas_ocupadas: number
  mesas_totales: number
  producto_estrella: string
  ingresos_ayer: number
}

export interface ActividadReciente {
  pedido_id: string
  mesa_nombre: string
  total: number
  cerrado_at: string
}
```

- [ ] **Step 2: Verificar que compila**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "negocio"
```

Sin errores en `types/negocio.ts`.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add types/negocio.ts; git commit -m "feat: tipos TypeScript para módulo Mi Negocio"
```

---

## Task 3: API Route

**Archivos:**
- Crear: `app/api/negocio/route.ts`

- [ ] **Step 1: Crear el Route Handler**

Crear `app/api/negocio/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RPC_MAP = {
  resumen:   'get_resumen_hoy',
  actividad: 'get_actividad_reciente',
} as const

type TipoNegocio = keyof typeof RPC_MAP

export async function GET(req: NextRequest) {
  const tipo = new URL(req.url).searchParams.get('tipo')

  if (!tipo || !(tipo in RPC_MAP)) {
    return NextResponse.json(
      { error: 'Parámetro tipo requerido: resumen | actividad' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase.rpc(RPC_MAP[tipo as TipoNegocio])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
```

- [ ] **Step 2: Verificar lint**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run lint 2>&1 | Select-String "api/negocio"
```

Sin errores nuevos.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add app/api/negocio/route.ts; git commit -m "feat: API route GET /api/negocio"
```

---

## Task 4: Página Server Component

**Archivos:**
- Crear: `app/dashboard/negocio/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/dashboard/negocio/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import NegocioMovil from '@/components/negocio/NegocioMovil'
import type { RolNombre } from '@/types/equipo'

export default async function NegocioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/login')

  const roles = userData.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null

  if (rol !== 'admin') redirect('/dashboard')

  return (
    <AppShell title="Mi negocio">
      <NegocioMovil />
    </AppShell>
  )
}
```

- [ ] **Step 2: Verificar lint**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run lint 2>&1 | Select-String "dashboard/negocio"
```

Sin errores nuevos.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add app/dashboard/negocio/page.tsx; git commit -m "feat: página server component /dashboard/negocio"
```

---

## Task 5: Client Component NegocioMovil

**Archivos:**
- Crear: `components/negocio/NegocioMovil.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/negocio/NegocioMovil.tsx`:

```typescript
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ResumenHoy, ActividadReciente } from '@/types/negocio'

function fmt(valor: number) {
  return valor.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

function tiempoDesde(fecha: Date): string {
  const mins = Math.floor((Date.now() - fecha.getTime()) / 60_000)
  if (mins < 1) return 'ahora mismo'
  if (mins === 1) return 'hace 1 min'
  return `hace ${mins} min`
}

function horaDeISO(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fechaHoy(): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())
}

function diferenciaVsAyer(
  hoy: number,
  ayer: number,
): { texto: string; color: string } {
  if (ayer === 0) return { texto: '— sin datos de ayer', color: 'text-gray-400' }
  const pct = ((hoy - ayer) / ayer) * 100
  if (Math.abs(pct) < 0.5) return { texto: '= igual que ayer', color: 'text-gray-500' }
  if (pct > 0) return { texto: `▲ +${pct.toFixed(1)}% vs ayer`, color: 'text-green-600' }
  return { texto: `▼ ${pct.toFixed(1)}% vs ayer`, color: 'text-red-500' }
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

export default function NegocioMovil() {
  const [resumen, setResumen]             = useState<ResumenHoy | null>(null)
  const [actividad, setActividad]         = useState<ActividadReciente[]>([])
  const [loadingResumen, setLoadingR]     = useState(true)
  const [loadingActividad, setLoadingA]   = useState(true)
  const [errorResumen, setErrorR]         = useState<string | null>(null)
  const [errorActividad, setErrorA]       = useState<string | null>(null)
  const [ultimaAct, setUltimaAct]         = useState<Date | null>(null)
  const [tiempoLabel, setTiempoLabel]     = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cargarResumen = useCallback(async () => {
    setLoadingR(true)
    setErrorR(null)
    try {
      const res = await fetch('/api/negocio?tipo=resumen')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResumen(json.data?.[0] ?? null)
    } catch (e) {
      setErrorR(String(e))
    } finally {
      setLoadingR(false)
    }
  }, [])

  const cargarActividad = useCallback(async () => {
    setLoadingA(true)
    setErrorA(null)
    try {
      const res = await fetch('/api/negocio?tipo=actividad')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setActividad(json.data ?? [])
    } catch (e) {
      setErrorA(String(e))
    } finally {
      setLoadingA(false)
    }
  }, [])

  const cargarTodo = useCallback(async () => {
    await Promise.all([cargarResumen(), cargarActividad()])
    const ahora = new Date()
    setUltimaAct(ahora)
    setTiempoLabel(tiempoDesde(ahora))
  }, [cargarResumen, cargarActividad])

  const recargar = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    await cargarTodo()
    intervalRef.current = setInterval(cargarTodo, 60_000)
  }, [cargarTodo])

  // Actualizar "hace X min" cada 30 s
  useEffect(() => {
    if (!ultimaAct) return
    const t = setInterval(() => setTiempoLabel(tiempoDesde(ultimaAct)), 30_000)
    return () => clearInterval(t)
  }, [ultimaAct])

  // Carga inicial + intervalo de 60 s
  useEffect(() => {
    cargarTodo()
    intervalRef.current = setInterval(cargarTodo, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const diff = resumen
    ? diferenciaVsAyer(Number(resumen.ingresos_hoy), Number(resumen.ingresos_ayer))
    : null

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-gray-50 px-4 py-6 flex flex-col gap-5">

      {/* Cabecera */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi negocio</h1>
          <p className="text-sm text-gray-500 capitalize">{fechaHoy()}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={recargar}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors text-lg"
            aria-label="Recargar datos"
          >
            🔄
          </button>
          {tiempoLabel && (
            <span className="text-[10px] text-gray-400">Actualizado {tiempoLabel}</span>
          )}
        </div>
      </div>

      {/* KPI principal + secundarios */}
      {errorResumen ? (
        <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm">
          <p className="text-sm text-red-500 mb-3">No se pudieron cargar los KPIs.</p>
          <button
            onClick={cargarResumen}
            className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Ingresos del día */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Ingresos de hoy
            </p>
            {loadingResumen ? (
              <>
                <Skeleton className="h-10 w-36 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <p className="text-4xl font-bold text-gray-900">
                  {fmt(Number(resumen?.ingresos_hoy ?? 0))}
                </p>
                {diff && (
                  <p className={`text-sm font-medium mt-1 ${diff.color}`}>{diff.texto}</p>
                )}
              </>
            )}
          </div>

          {/* Grid 2x2 KPIs secundarios */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-[11px] text-gray-500 mb-1">📋 Pedidos cerrados</p>
              {loadingResumen ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">
                  {resumen?.pedidos_cerrados ?? 0}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-[11px] text-gray-500 mb-1">🧾 Ticket medio</p>
              {loadingResumen ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">
                  {fmt(Number(resumen?.ticket_medio ?? 0))}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-[11px] text-gray-500 mb-1">🪑 Mesas ocupadas</p>
              {loadingResumen ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">
                  {resumen?.mesas_ocupadas ?? 0}
                  <span className="text-base font-normal text-gray-400">
                    {' '}/ {resumen?.mesas_totales ?? 0}
                  </span>
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-[11px] text-gray-500 mb-1">⭐ Producto estrella</p>
              {loadingResumen ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <p className="text-sm font-bold text-gray-900 leading-tight mt-1 truncate">
                  {resumen?.producto_estrella ?? '—'}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Actividad reciente */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-800 mb-3">Últimos pedidos de hoy</p>
        {errorActividad ? (
          <p className="text-sm text-gray-500">No se pudo cargar la actividad reciente.</p>
        ) : loadingActividad ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : actividad.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay pedidos cerrados hoy.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {actividad.map((a) => (
              <li key={a.pedido_id} className="flex items-center justify-between py-2.5 gap-3">
                <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                  {a.mesa_nombre}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {horaDeISO(a.cerrado_at)}
                </span>
                <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                  {fmt(Number(a.total))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
```

- [ ] **Step 2: Verificar lint**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run lint 2>&1 | Select-String "NegocioMovil"
```

Sin errores nuevos (puede haber un warning de `react-hooks/exhaustive-deps` en el segundo `useEffect` — esperado y correcto).

- [ ] **Step 3: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add components/negocio/NegocioMovil.tsx; git commit -m "feat: client component NegocioMovil con KPIs y auto-refresh"
```

---

## Task 6: Navegación

**Archivos:**
- Modificar: `app/dashboard/page.tsx`
- Modificar: `components/NavDrawer.tsx`

- [ ] **Step 1: Añadir tarjeta "Mi negocio" a NAV_CARDS**

En `app/dashboard/page.tsx`, añadir esta entrada en el array `NAV_CARDS` **antes** de la entrada `'/dashboard/configuracion'`:

```typescript
  {
    href: '/dashboard/negocio',
    icon: '🏪',
    label: 'Mi negocio',
    description: 'KPIs del día en un vistazo',
    color: 'bg-[var(--bg-surface)] border-indigo-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-indigo-500/15',
    labelColor: 'text-indigo-600',
    modulo: 'administracion',
  },
```

- [ ] **Step 2: Añadir enlace "Mi negocio" a NavDrawer**

En `components/NavDrawer.tsx`, añadir esta entrada en `NAV_ITEMS` justo después de la línea de `'/dashboard'`:

```typescript
  { href: '/dashboard/negocio', label: 'Mi negocio', icon: '🏪' },
```

- [ ] **Step 3: Verificar lint**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run lint 2>&1 | Select-String "dashboard/page|NavDrawer"
```

Sin errores nuevos.

- [ ] **Step 4: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add app/dashboard/page.tsx components/NavDrawer.tsx; git commit -m "feat: enlace Mi negocio en navegación del dashboard"
```

---

## Task 7: Build final y push

- [ ] **Step 1: Build de producción**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run build 2>&1
```

Resultado esperado: `✓ Compiled successfully` con `/dashboard/negocio` en el listado de rutas, sin errores TypeScript.

Si hay error de TypeScript en `NegocioMovil.tsx` por el tipo de `setInterval` en el ref: cambia `ReturnType<typeof setInterval>` por `NodeJS.Timeout`.

- [ ] **Step 2: Push**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git push origin master 2>&1
```

---

## Self-Review

**Spec coverage:**
- ✅ Función SQL `get_resumen_hoy` con ingresos, pedidos, ticket medio, mesas, producto estrella, comparativa ayer (Task 1)
- ✅ Función SQL `get_actividad_reciente` con últimos 8 pedidos del día (Task 1)
- ✅ Columnas reales: `total` y `updated_at` (no `total_amount`/`closed_at`)
- ✅ Tipos TypeScript `ResumenHoy` + `ActividadReciente` (Task 2)
- ✅ API Route `/api/negocio?tipo=resumen|actividad` (Task 3)
- ✅ Server Component con guard `rol === 'admin'` → redirect `/dashboard` (Task 4)
- ✅ max-width 430px, mx-auto, min-h-screen, bg-gray-50 (Task 5)
- ✅ Cabecera con fecha es-ES, botón refresh, "Actualizado hace X min" (Task 5)
- ✅ KPI principal con ingresos_hoy y comparativa ▲/▼ vs ayer (Task 5)
- ✅ Grid 2x2: pedidos, ticket medio, mesas X/Y, producto estrella (Task 5)
- ✅ Actividad reciente: mesa, hora, total; mensaje vacío si no hay pedidos (Task 5)
- ✅ Auto-refresh cada 60 s con cleanup de setInterval (Task 5)
- ✅ Skeleton loaders en todos los KPIs (Task 5)
- ✅ Error resumen → tarjeta con "Reintentar"; error actividad → mensaje inline (Task 5)
- ✅ Fetches paralelos con Promise.all (Task 5)
- ✅ NAV_CARDS + NavDrawer (Task 6)
- ✅ Build + push (Task 7)

**Placeholder scan:** ninguno — todo el código está completo.

**Type consistency:** `ResumenHoy` y `ActividadReciente` definidos en Task 2, usados en Task 5. `json.data?.[0]` para `get_resumen_hoy` (devuelve una fila), `json.data ?? []` para `get_actividad_reciente` (devuelve array).
