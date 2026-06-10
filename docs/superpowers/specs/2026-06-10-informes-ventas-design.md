# Informes de Ventas Operativos — Design Spec

**Fecha:** 2026-06-10
**Stack:** Next.js App Router, Supabase, TypeScript, Tailwind CSS, Recharts
**Módulo de permisos:** `administracion`

---

## Objetivo

Página `/dashboard/informes` con cuatro dimensiones de análisis de ventas (franjas horarias, camareros, productos, KPIs) filtradas por rango de fechas. Los datos se calculan en Supabase mediante funciones RPC y se muestran con gráficos y tablas.

---

## Adaptaciones de esquema real

Las columnas de `orders` difieren del spec original:

| Campo original (spec) | Campo real (BD) | Decisión |
|---|---|---|
| `orders.closed_at` | No existe | Usar `orders.updated_at` como proxy del momento de cierre (se actualiza cuando el pedido pasa a `paid`) |
| `orders.total_amount` | `orders.total` | Usar `total` en todas las funciones SQL |
| `orders.created_by` | `orders.opened_by` | Usar `opened_by` para JOIN con `users.auth_id` |

---

## Arquitectura

```
[app/dashboard/informes/page.tsx]  (Server Component)
  └── verifica sesión + permisos (módulo: administracion)
  └── renderiza <InformesCliente />

[components/informes/InformesCliente.tsx]  (Client Component)
  └── estado: rango de fechas seleccionado
  └── fetch paralelo a /api/informes?tipo=...&desde=...&hasta=...
  └── renderiza KPIs, gráfico franjas, tabla camareros, ranking productos

[app/api/informes/route.ts]  (Route Handler GET)
  └── recibe params: tipo, desde, hasta
  └── usa createClient() servidor con sesión del usuario
  └── llama RPC correspondiente
  └── devuelve JSON

[types/informes.ts]
  └── VentasFranja, VentasCamarero, ProductoRanking, ResumenVentas, RangoFecha

[Supabase RPCs] (creadas manualmente)
  └── get_ventas_por_franja(p_desde, p_hasta)
  └── get_ventas_por_camarero(p_desde, p_hasta)
  └── get_productos_ranking(p_desde, p_hasta)
  └── get_resumen_ventas(p_desde, p_hasta)
```

---

## Funciones SQL RPC

Todas filtran por `get_current_restaurant_id()` (función ya usada en RLS, trabaja con `auth.uid()`).

### get_ventas_por_franja

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

### get_ventas_por_camarero

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

**Nota:** Si `opened_by` no existe en `orders`, la función igual se crea devolviendo `'No disponible'` hardcoded.

### get_productos_ranking

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
  GROUP BY p.name, c.name, oi.product_name
  ORDER BY unidades_vendidas DESC;
$$;
```

**Nota:** usa `oi.product_name` como fallback (order_items guarda el nombre en el momento del pedido).

### get_resumen_ventas

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

Permisos tras crear las 4 funciones:
```sql
GRANT EXECUTE ON FUNCTION get_ventas_por_franja TO authenticated;
GRANT EXECUTE ON FUNCTION get_ventas_por_camarero TO authenticated;
GRANT EXECUTE ON FUNCTION get_productos_ranking TO authenticated;
GRANT EXECUTE ON FUNCTION get_resumen_ventas TO authenticated;
```

---

## Tipos TypeScript (`types/informes.ts`)

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

---

## API Route (`app/api/informes/route.ts`)

GET handler. Query params: `tipo` (franja|camarero|productos|resumen), `desde` (ISO string), `hasta` (ISO string).

- Usa `createClient()` del servidor (sesión del usuario)
- Verifica autenticación; si no hay sesión → 401
- Llama `supabase.rpc('get_<tipo>', { p_desde: desde, p_hasta: hasta })`
- En error Supabase → 500 con `{ error: mensaje }`
- Éxito → `{ data: [...] }`

---

## Página Server Component (`app/dashboard/informes/page.tsx`)

- Obtiene sesión con `createClient()` → redirect a `/login` si no hay sesión
- Obtiene `restaurant_id` y `rol` desde `users` (mismo patrón que `finanzas/page.tsx`)
- Verifica `PERMISOS_POR_ROL[rol].modulos.includes('administracion')`
- Si sin acceso → renderiza mensaje de acceso denegado dentro de `<AppShell>`
- Si tiene acceso → `<AppShell title="Informes"><InformesCliente /></AppShell>`

---

## Client Component (`components/informes/InformesCliente.tsx`)

### Estado
```typescript
const [rango, setRango] = useState<RangoFecha>('30d')
const [desde, setDesde] = useState<string>('')  // solo si custom
const [hasta, setHasta] = useState<string>('')  // solo si custom
const [loading, setLoading] = useState(true)
const [resumen, setResumen] = useState<ResumenVentas | null>(null)
const [franjas, setFranjas] = useState<VentasFranja[]>([])
const [camareros, setCamareros] = useState<VentasCamarero[]>([])
const [productos, setProductos] = useState<ProductoRanking[]>([])
const [errores, setErrores] = useState<Record<string, string>>({})
```

### Cálculo de fechas
```typescript
function calcularRango(rango: RangoFecha, desdeCustom: string, hastaCustom: string): [string, string] {
  const hasta = new Date()
  hasta.setHours(23, 59, 59, 999)
  if (rango === 'custom') return [new Date(desdeCustom).toISOString(), hasta.toISOString()]
  const desde = new Date()
  const dias = rango === '7d' ? 7 : rango === '30d' ? 30 : 90
  desde.setDate(desde.getDate() - dias)
  desde.setHours(0, 0, 0, 0)
  return [desde.toISOString(), hasta.toISOString()]
}
```

### Fetch paralelo
```typescript
async function cargarDatos() {
  setLoading(true)
  const [d, h] = calcularRango(rango, desde, hasta)
  const tipos = ['resumen', 'franja', 'camarero', 'productos'] as const
  const resultados = await Promise.allSettled(
    tipos.map(t => fetch(`/api/informes?tipo=${t}&desde=${d}&hasta=${h}`).then(r => r.json()))
  )
  // Mapear resultados, setear errores individuales si rejected o data.error
}
```

### Layout visual

```
[Filtros: botones 7d | 30d | 90d | Personalizado] [inputs fecha si custom] [Botón Actualizar]

[KPI: Total ingresos] [KPI: Nº pedidos] [KPI: Ticket medio] [KPI: Productos distintos]

[BarChart: Ventas por franja horaria — eje X: franja, eje Y: €, color #4F46E5]

[Tabla: Camareros — Camarero | Pedidos | Ingresos | Ticket medio]

[Top 10 más vendidos | Bottom 10 menos vendidos]
```

- Skeleton loader (divs `animate-pulse bg-gray-200 rounded`) durante loading
- Error por sección: si un fetch falla, mostrar mensaje de error solo en esa sección
- Valores monetarios: `${valor.toFixed(2)} €`
- Carga inicial con rango `30d`

---

## Navegación

### `app/dashboard/page.tsx` — NAV_CARDS

Añadir entrada antes de "Configuración":
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

### `components/NavDrawer.tsx` — NAV_ITEMS

Añadir entrada:
```typescript
{ href: '/dashboard/informes', label: 'Informes', icon: '📊' },
```

---

## Restricciones

- No modificar tablas existentes
- No crear tablas nuevas
- Todas las queries pasan por RPCs con `get_current_restaurant_id()` (RLS respetado)
- Usar `updated_at` como proxy de `closed_at` en pedidos pagados
- Usar `total` (no `total_amount`) y `opened_by` (no `created_by`)
- No usar `<label>` — usar divs/spans para textos de campo
- Todo el texto UI en español

---

## Archivos creados/modificados

| Acción | Archivo |
|---|---|
| CREAR | `types/informes.ts` |
| CREAR | `app/api/informes/route.ts` |
| CREAR | `app/dashboard/informes/page.tsx` |
| CREAR | `components/informes/InformesCliente.tsx` |
| MODIFICAR | `app/dashboard/page.tsx` (NAV_CARDS) |
| MODIFICAR | `components/NavDrawer.tsx` (NAV_ITEMS) |
| MANUAL | Crear 4 funciones RPC en Supabase + GRANT |
