# Informes de Ventas Operativos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la página `/dashboard/informes` con KPIs, gráfico de franjas horarias, tabla de camareros y ranking de productos, calculados desde Supabase mediante RPCs.

**Architecture:** Cuatro funciones SQL RPC en Supabase calculan los datos filtrados por restaurante y rango de fechas. Una API Route GET despacha las llamadas. Una página Server Component verifica sesión/permisos y renderiza el Client Component que maneja filtros, fetches paralelos y UI.

**Tech Stack:** Next.js 16 App Router, Supabase (RPC), TypeScript, Tailwind CSS, Recharts 3.x

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|---|---|---|
| CREAR | `types/informes.ts` | Tipos TypeScript para los datos de informes |
| CREAR | `app/api/informes/route.ts` | Route Handler GET — despacha RPCs según `tipo` |
| CREAR | `app/dashboard/informes/page.tsx` | Server Component — sesión, permisos, shell |
| CREAR | `components/informes/InformesCliente.tsx` | Client Component — filtros, fetches, UI completa |
| MODIFICAR | `app/dashboard/page.tsx` | Añadir tarjeta "Informes" a NAV_CARDS |
| MODIFICAR | `components/NavDrawer.tsx` | Añadir enlace "Informes" a NAV_ITEMS |
| MANUAL | Supabase SQL editor | Crear 4 RPCs + GRANTs |

---

## Contexto técnico crítico

- **`orders.closed_at` NO existe** → usar `updated_at` (se actualiza cuando status pasa a `paid`)
- **`orders.total_amount` NO existe** → usar `total`
- **`orders.created_by` NO existe** → usar `opened_by` para JOIN con `users.auth_id`
- **`order_items.product_name`** existe y guarda el nombre en el momento del pedido (fallback para productos eliminados)
- **Módulo de permisos:** `administracion`
- **Patrón de página dashboard** (igual que `app/dashboard/finanzas/page.tsx`): `createClient()` servidor → getUser → redirect si no hay sesión → query `users` para restaurant_id + roles → check `PERMISOS_POR_ROL[rol].modulos.includes('administracion')`
- **Patrón de API route:** igual que `app/api/cliente/[slug]/route.ts` — `createClient()` servidor, verificar user, llamar RPC, devolver `{ data }` o `{ error }`
- **Recharts:** ya instalado (v3.8.1). Importar: `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer`

---

## Task 1: SQL RPCs en Supabase (paso manual)

**Archivos:** ninguno — SQL a ejecutar en el editor de Supabase

Este task es **manual**. El implementador debe pegar y ejecutar cada bloque SQL en el SQL Editor de Supabase (`https://app.supabase.com` → proyecto → SQL Editor).

- [ ] **Step 1: Crear función get_ventas_por_franja**

```sql
CREATE OR REPLACE FUNCTION get_ventas_por_franja(
  p_desde TIMESTAMPTZ,
  p_hasta TIMESTAMPTZ
)
RETURNS TABLE (franja TEXT, total_ventas NUMERIC, num_pedidos BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT
    CASE
      WHEN EXTRACT(HOUR FROM updated_at) BETWEEN 7 AND 11 THEN 'Mañana (7-12h)'
      WHEN EXTRACT(HOUR FROM updated_at) BETWEEN 12 AND 15 THEN 'Mediodía (12-16h)'
      WHEN EXTRACT(HOUR FROM updated_at) BETWEEN 16 AND 19 THEN 'Tarde (16-20h)'
      WHEN EXTRACT(HOUR FROM updated_at) BETWEEN 20 AND 23 THEN 'Noche (20-24h)'
      ELSE 'Madrugada (0-7h)'
    END AS franja,
    COALESCE(SUM(total), 0) AS total_ventas,
    COUNT(*) AS num_pedidos
  FROM orders
  WHERE restaurant_id = get_current_restaurant_id()
    AND status = 'paid'
    AND updated_at BETWEEN p_desde AND p_hasta
  GROUP BY 1
  ORDER BY MIN(EXTRACT(HOUR FROM updated_at));
$$;
```

- [ ] **Step 2: Crear función get_ventas_por_camarero**

```sql
CREATE OR REPLACE FUNCTION get_ventas_por_camarero(
  p_desde TIMESTAMPTZ,
  p_hasta TIMESTAMPTZ
)
RETURNS TABLE (camarero_nombre TEXT, total_ventas NUMERIC, num_pedidos BIGINT, ticket_medio NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(u.full_name, u.username, 'Sin asignar') AS camarero_nombre,
    COALESCE(SUM(o.total), 0) AS total_ventas,
    COUNT(o.id) AS num_pedidos,
    COALESCE(AVG(o.total), 0) AS ticket_medio
  FROM orders o
  LEFT JOIN users u ON u.auth_id = o.opened_by
  WHERE o.restaurant_id = get_current_restaurant_id()
    AND o.status = 'paid'
    AND o.updated_at BETWEEN p_desde AND p_hasta
  GROUP BY u.full_name, u.username
  ORDER BY total_ventas DESC;
$$;
```

**Nota:** si `orders.opened_by` no existe, la función fallará. En ese caso usa esta versión sin JOIN:

```sql
CREATE OR REPLACE FUNCTION get_ventas_por_camarero(
  p_desde TIMESTAMPTZ,
  p_hasta TIMESTAMPTZ
)
RETURNS TABLE (camarero_nombre TEXT, total_ventas NUMERIC, num_pedidos BIGINT, ticket_medio NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT
    'No disponible'::TEXT AS camarero_nombre,
    COALESCE(SUM(total), 0) AS total_ventas,
    COUNT(id) AS num_pedidos,
    COALESCE(AVG(total), 0) AS ticket_medio
  FROM orders
  WHERE restaurant_id = get_current_restaurant_id()
    AND status = 'paid'
    AND updated_at BETWEEN p_desde AND p_hasta;
$$;
```

- [ ] **Step 3: Crear función get_productos_ranking**

```sql
CREATE OR REPLACE FUNCTION get_productos_ranking(
  p_desde TIMESTAMPTZ,
  p_hasta TIMESTAMPTZ
)
RETURNS TABLE (producto_nombre TEXT, categoria_nombre TEXT, unidades_vendidas BIGINT, ingresos NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(p.name, oi.product_name, 'Producto eliminado') AS producto_nombre,
    c.name AS categoria_nombre,
    SUM(oi.quantity)::BIGINT AS unidades_vendidas,
    SUM(oi.quantity * oi.unit_price) AS ingresos
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE o.restaurant_id = get_current_restaurant_id()
    AND o.status = 'paid'
    AND o.updated_at BETWEEN p_desde AND p_hasta
  GROUP BY COALESCE(p.name, oi.product_name, 'Producto eliminado'), c.name
  ORDER BY unidades_vendidas DESC;
$$;
```

- [ ] **Step 4: Crear función get_resumen_ventas**

```sql
CREATE OR REPLACE FUNCTION get_resumen_ventas(
  p_desde TIMESTAMPTZ,
  p_hasta TIMESTAMPTZ
)
RETURNS TABLE (
  total_ingresos NUMERIC,
  num_pedidos BIGINT,
  ticket_medio NUMERIC,
  productos_distintos BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(SUM(o.total), 0) AS total_ingresos,
    COUNT(o.id) AS num_pedidos,
    COALESCE(AVG(o.total), 0) AS ticket_medio,
    COUNT(DISTINCT oi.product_id) AS productos_distintos
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.restaurant_id = get_current_restaurant_id()
    AND o.status = 'paid'
    AND o.updated_at BETWEEN p_desde AND p_hasta;
$$;
```

- [ ] **Step 5: Otorgar permisos**

```sql
GRANT EXECUTE ON FUNCTION get_ventas_por_franja TO authenticated;
GRANT EXECUTE ON FUNCTION get_ventas_por_camarero TO authenticated;
GRANT EXECUTE ON FUNCTION get_productos_ranking TO authenticated;
GRANT EXECUTE ON FUNCTION get_resumen_ventas TO authenticated;
```

- [ ] **Step 6: Verificar que las funciones existen**

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_ventas_por_franja',
  'get_ventas_por_camarero',
  'get_productos_ranking',
  'get_resumen_ventas'
);
```

Resultado esperado: 4 filas.

---

## Task 2: Tipos TypeScript

**Archivos:**
- Crear: `types/informes.ts`

- [ ] **Step 1: Crear el archivo de tipos**

Crear `types/informes.ts` con este contenido exacto:

```typescript
export interface VentasFranja {
  franja: string
  total_ventas: number
  num_pedidos: number
}

export interface VentasCamarero {
  camarero_nombre: string
  total_ventas: number
  num_pedidos: number
  ticket_medio: number
}

export interface ProductoRanking {
  producto_nombre: string
  categoria_nombre: string | null
  unidades_vendidas: number
  ingresos: number
}

export interface ResumenVentas {
  total_ingresos: number
  num_pedidos: number
  ticket_medio: number
  productos_distintos: number
}

export type RangoFecha = '7d' | '30d' | '90d' | 'custom'
```

- [ ] **Step 2: Verificar que el archivo compila**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "informes"
```

Sin errores en `types/informes.ts`.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add types/informes.ts; git commit -m "feat: tipos TypeScript para módulo de informes"
```

---

## Task 3: API Route

**Archivos:**
- Crear: `app/api/informes/route.ts`

- [ ] **Step 1: Crear el Route Handler**

Crear `app/api/informes/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RPC_MAP = {
  franja:    'get_ventas_por_franja',
  camarero:  'get_ventas_por_camarero',
  productos: 'get_productos_ranking',
  resumen:   'get_resumen_ventas',
} as const

type TipoInforme = keyof typeof RPC_MAP

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tipo   = searchParams.get('tipo')
  const desde  = searchParams.get('desde')
  const hasta  = searchParams.get('hasta')

  if (!tipo || !desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros requeridos: tipo, desde, hasta' }, { status: 400 })
  }

  if (!(tipo in RPC_MAP)) {
    return NextResponse.json({ error: `Tipo no válido: ${tipo}` }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const rpcName = RPC_MAP[tipo as TipoInforme]
  const { data, error } = await supabase.rpc(rpcName, { p_desde: desde, p_hasta: hasta })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
```

- [ ] **Step 2: Verificar lint**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run lint 2>&1 | Select-String "api/informes"
```

Sin errores nuevos.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add app/api/informes/route.ts; git commit -m "feat: API route GET /api/informes"
```

---

## Task 4: Página Server Component

**Archivos:**
- Crear: `app/dashboard/informes/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/dashboard/informes/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import InformesCliente from '@/components/informes/InformesCliente'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

export default async function InformesPage() {
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
  const tieneAcceso = !rol || PERMISOS_POR_ROL[rol].modulos.includes('administracion')

  if (!tieneAcceso) {
    return (
      <AppShell title="Informes">
        <div className="flex items-center justify-center h-64">
          <p className="text-[var(--text-secondary)]">No tienes acceso a esta sección.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Informes">
      <InformesCliente />
    </AppShell>
  )
}
```

- [ ] **Step 2: Verificar lint**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run lint 2>&1 | Select-String "dashboard/informes"
```

Sin errores nuevos.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add app/dashboard/informes/page.tsx; git commit -m "feat: página server component /dashboard/informes"
```

---

## Task 5: Client Component InformesCliente

**Archivos:**
- Crear: `components/informes/InformesCliente.tsx`

Este es el componente principal de la UI. Implementa filtros, fetches paralelos, KPIs, gráfico de barras, tabla de camareros y ranking de productos.

- [ ] **Step 1: Crear el directorio y el componente**

Crear `components/informes/InformesCliente.tsx`:

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type {
  VentasFranja, VentasCamarero, ProductoRanking, ResumenVentas, RangoFecha,
} from '@/types/informes'

function calcularRango(
  rango: RangoFecha,
  desdeCustom: string,
  hastaCustom: string,
): [string, string] {
  const hasta = new Date()
  hasta.setHours(23, 59, 59, 999)
  if (rango === 'custom') {
    const d = new Date(desdeCustom + 'T00:00:00')
    const h = new Date(hastaCustom + 'T23:59:59')
    return [d.toISOString(), h.toISOString()]
  }
  const desde = new Date()
  const dias = rango === '7d' ? 7 : rango === '30d' ? 30 : 90
  desde.setDate(desde.getDate() - dias)
  desde.setHours(0, 0, 0, 0)
  return [desde.toISOString(), hasta.toISOString()]
}

function fmt(valor: number) {
  return `${Number(valor).toFixed(2)} €`
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

const RANGOS: { id: RangoFecha; label: string }[] = [
  { id: '7d',     label: 'Últimos 7 días' },
  { id: '30d',    label: 'Últimos 30 días' },
  { id: '90d',    label: 'Últimos 90 días' },
  { id: 'custom', label: 'Personalizado' },
]

const KPI_CONFIG: { key: keyof ResumenVentas; label: string; moneda: boolean }[] = [
  { key: 'total_ingresos',     label: 'Total ingresos',      moneda: true },
  { key: 'num_pedidos',        label: 'Nº pedidos',          moneda: false },
  { key: 'ticket_medio',       label: 'Ticket medio',        moneda: true },
  { key: 'productos_distintos', label: 'Productos distintos', moneda: false },
]

export default function InformesCliente() {
  const [rango, setRango]         = useState<RangoFecha>('30d')
  const [desde, setDesde]         = useState('')
  const [hasta, setHasta]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [resumen, setResumen]     = useState<ResumenVentas | null>(null)
  const [franjas, setFranjas]     = useState<VentasFranja[]>([])
  const [camareros, setCamareros] = useState<VentasCamarero[]>([])
  const [productos, setProductos] = useState<ProductoRanking[]>([])
  const [errores, setErrores]     = useState<Record<string, string>>({})

  const cargarDatos = useCallback(async () => {
    if (rango === 'custom' && (!desde || !hasta)) return
    setLoading(true)
    setErrores({})

    const [d, h] = calcularRango(rango, desde, hasta)
    const base = `/api/informes?desde=${encodeURIComponent(d)}&hasta=${encodeURIComponent(h)}`

    const [resumenRes, franjasRes, camarerosRes, productosRes] = await Promise.allSettled([
      fetch(`${base}&tipo=resumen`).then(r => r.json()),
      fetch(`${base}&tipo=franja`).then(r => r.json()),
      fetch(`${base}&tipo=camarero`).then(r => r.json()),
      fetch(`${base}&tipo=productos`).then(r => r.json()),
    ])

    const e: Record<string, string> = {}

    if (resumenRes.status === 'fulfilled' && !resumenRes.value.error) {
      setResumen(resumenRes.value.data?.[0] ?? null)
    } else {
      e.resumen = resumenRes.status === 'rejected'
        ? String(resumenRes.reason)
        : resumenRes.value.error
    }

    if (franjasRes.status === 'fulfilled' && !franjasRes.value.error) {
      setFranjas(franjasRes.value.data ?? [])
    } else {
      e.franjas = franjasRes.status === 'rejected'
        ? String(franjasRes.reason)
        : franjasRes.value.error
    }

    if (camarerosRes.status === 'fulfilled' && !camarerosRes.value.error) {
      setCamareros(camarerosRes.value.data ?? [])
    } else {
      e.camareros = camarerosRes.status === 'rejected'
        ? String(camarerosRes.reason)
        : camarerosRes.value.error
    }

    if (productosRes.status === 'fulfilled' && !productosRes.value.error) {
      setProductos(productosRes.value.data ?? [])
    } else {
      e.productos = productosRes.status === 'rejected'
        ? String(productosRes.reason)
        : productosRes.value.error
    }

    setErrores(e)
    setLoading(false)
  }, [rango, desde, hasta])

  useEffect(() => { cargarDatos() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const top10    = productos.slice(0, 10)
  const bottom10 = [...productos].reverse().slice(0, 10)

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {RANGOS.map(r => (
          <button
            key={r.id}
            onClick={() => setRango(r.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              rango === r.id
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {r.label}
          </button>
        ))}
        {rango === 'custom' && (
          <>
            <input
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black"
            />
            <input
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black"
            />
          </>
        )}
        <button
          onClick={cargarDatos}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
        >
          Actualizar
        </button>
      </div>

      {/* ── KPIs ── */}
      {errores.resumen ? (
        <p className="text-sm text-red-500">Error al cargar KPIs: {errores.resumen}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPI_CONFIG.map(({ key, label, moneda }) => (
            <div
              key={key}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4"
            >
              <div className="text-xs text-[var(--text-secondary)] mb-1">{label}</div>
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <div className="text-xl font-bold text-[var(--text-primary)]">
                  {moneda
                    ? fmt(Number(resumen?.[key] ?? 0))
                    : String(resumen?.[key] ?? 0)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Gráfico franjas ── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Ventas por franja horaria
        </div>
        {errores.franjas ? (
          <p className="text-sm text-red-500">Error: {errores.franjas}</p>
        ) : loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={franjas} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="franja" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} />
              <Tooltip
                formatter={(value: number) => [`${Number(value).toFixed(2)} €`, 'Ventas']}
              />
              <Bar dataKey="total_ventas" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Tabla camareros ── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Ventas por camarero
        </div>
        {errores.camareros ? (
          <p className="text-sm text-red-500">Error: {errores.camareros}</p>
        ) : loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : camareros.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Datos de camarero no disponibles en este período.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="pb-2 text-xs font-medium text-[var(--text-secondary)]">Camarero</th>
                <th className="pb-2 text-xs font-medium text-[var(--text-secondary)] text-right">Pedidos</th>
                <th className="pb-2 text-xs font-medium text-[var(--text-secondary)] text-right">Ingresos</th>
                <th className="pb-2 text-xs font-medium text-[var(--text-secondary)] text-right">Ticket medio</th>
              </tr>
            </thead>
            <tbody>
              {camareros.map((c, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 text-[var(--text-primary)]">{c.camarero_nombre}</td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">{c.num_pedidos}</td>
                  <td className="py-2 text-right font-medium text-[var(--text-primary)]">
                    {fmt(Number(c.total_ventas))}
                  </td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">
                    {fmt(Number(c.ticket_medio))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Ranking de productos ── */}
      {errores.productos ? (
        <p className="text-sm text-red-500">Error al cargar productos: {errores.productos}</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Top 10 */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              Top 10 más vendidos
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : top10.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Sin datos en este período.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {top10.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="text-[var(--text-secondary)] w-5 flex-shrink-0 text-right">
                      {i + 1}.
                    </span>
                    <span className="flex-1 text-[var(--text-primary)] truncate">
                      {p.producto_nombre}
                    </span>
                    <span className="text-[var(--text-secondary)] flex-shrink-0 text-xs">
                      {p.unidades_vendidas} ud.
                    </span>
                    <span className="font-medium text-[var(--text-primary)] flex-shrink-0">
                      {fmt(Number(p.ingresos))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Bottom 10 */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              Bottom 10 menos vendidos
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : bottom10.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Sin datos en este período.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {bottom10.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="text-[var(--text-secondary)] w-5 flex-shrink-0 text-right">
                      {i + 1}.
                    </span>
                    <span className="flex-1 text-[var(--text-primary)] truncate">
                      {p.producto_nombre}
                    </span>
                    <span className="text-[var(--text-secondary)] flex-shrink-0 text-xs">
                      {p.unidades_vendidas} ud.
                    </span>
                    <span className="font-medium text-[var(--text-primary)] flex-shrink-0">
                      {fmt(Number(p.ingresos))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar lint**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run lint 2>&1 | Select-String "InformesCliente"
```

Sin errores nuevos (puede haber un warning de `react-hooks/exhaustive-deps` por el `useEffect` — es esperado y aceptable dado que queremos carga manual con `Actualizar`).

- [ ] **Step 3: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add components/informes/InformesCliente.tsx; git commit -m "feat: client component InformesCliente con filtros, KPIs y gráficos"
```

---

## Task 6: Navegación

**Archivos:**
- Modificar: `app/dashboard/page.tsx` (líneas 8-109, array `NAV_CARDS`)
- Modificar: `components/NavDrawer.tsx` (líneas 8-15, array `NAV_ITEMS`)

- [ ] **Step 1: Añadir tarjeta "Informes" a NAV_CARDS**

En `app/dashboard/page.tsx`, localiza el array `NAV_CARDS`. Añade la siguiente entrada **antes** del objeto de Configuración (`href: '/dashboard/configuracion'`):

```typescript
  {
    href: '/dashboard/informes',
    icon: '📊',
    label: 'Informes',
    description: 'Ventas, productos y franjas horarias',
    color: 'bg-[var(--bg-surface)] border-cyan-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-cyan-500/15',
    labelColor: 'text-cyan-600',
    modulo: 'administracion',
  },
```

- [ ] **Step 2: Añadir enlace "Informes" a NavDrawer**

En `components/NavDrawer.tsx`, localiza el array `NAV_ITEMS` (líneas 8-15). Añade la siguiente entrada al final del array (antes del cierre `]`):

```typescript
  { href: '/dashboard/informes', label: 'Informes', icon: '📊' },
```

- [ ] **Step 3: Verificar lint**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run lint 2>&1 | Select-String "dashboard/page|NavDrawer"
```

Sin errores nuevos.

- [ ] **Step 4: Commit**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git add app/dashboard/page.tsx components/NavDrawer.tsx; git commit -m "feat: enlace Informes en navegación del dashboard"
```

---

## Task 7: Build final y push

**Archivos:** ninguno (solo verificación)

- [ ] **Step 1: Build de producción**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run build 2>&1
```

Resultado esperado: `✓ Compiled successfully` y `✓ Generating static pages` sin errores de TypeScript.

Si hay errores, son de uno de estos tipos:
- **TypeScript en InformesCliente** — puede ocurrir si Recharts no exporta los tipos que se esperan. Solución: añadir `// @ts-ignore` sobre la línea problemática o cambiar el tipo del `formatter` a `(value: unknown) => [string, string]`.
- **TypeScript en page.tsx** — verificar que `InformesCliente` se importa correctamente y que el módulo existe.

- [ ] **Step 2: Push**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; git push origin master 2>&1
```

---

## Self-Review

**Spec coverage:**
- ✅ 4 funciones SQL RPC (Task 1)
- ✅ Tipos TypeScript (Task 2)
- ✅ API Route GET con 4 tipos (Task 3)
- ✅ Server Component con auth + permisos `administracion` (Task 4)
- ✅ Client Component con filtros 7d/30d/90d/custom (Task 5)
- ✅ KPIs con skeleton (Task 5)
- ✅ BarChart Recharts con color #4F46E5 (Task 5)
- ✅ Tabla camareros con mensaje vacío (Task 5)
- ✅ Top 10 + Bottom 10 productos (Task 5)
- ✅ Fetches paralelos con Promise.allSettled (Task 5)
- ✅ Error por sección independiente (Task 5)
- ✅ Carga inicial con 30d (Task 5 — useEffect al montar)
- ✅ NAV_CARDS + NavDrawer (Task 6)
- ✅ Build + push (Task 7)

**Placeholder scan:** ninguno encontrado — todo el código está completo.

**Type consistency:** `ResumenVentas`, `VentasFranja`, `VentasCamarero`, `ProductoRanking`, `RangoFecha` definidos en Task 2 y usados consistentemente en Tasks 3, 4, 5.
