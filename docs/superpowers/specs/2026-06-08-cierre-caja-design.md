# Spec: Módulo de Cierre de Caja

**Fecha:** 2026-06-08  
**Estado:** Aprobado

---

## Objetivo

Permitir a admin/gerente abrir y cerrar turnos de caja, registrando el fondo inicial, calculando automáticamente el efectivo esperado a partir de los tickets del turno, y guardando el descuadre entre lo esperado y lo contado físicamente.

---

## Tabla en base de datos

La tabla `turnos_caja` ya está creada en Supabase con el siguiente esquema:

```sql
CREATE TABLE turnos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  abierto_por UUID NOT NULL REFERENCES users(id),
  cerrado_por UUID REFERENCES users(id),
  fondo_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  efectivo_esperado DECIMAL(10,2),
  efectivo_contado DECIMAL(10,2),
  descuadre DECIMAL(10,2),
  total_ventas DECIMAL(10,2),
  total_efectivo DECIMAL(10,2),
  total_tarjeta DECIMAL(10,2),
  total_tickets INTEGER,
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS activo con política `restaurant_id = get_current_restaurant_id()`.

---

## Tipos TypeScript

Archivo: `types/caja.ts`

```typescript
export type EstadoTurno = 'abierto' | 'cerrado'

export interface TurnoCaja {
  id: string
  restaurant_id: string
  abierto_por: string
  cerrado_por: string | null
  fondo_inicial: number
  fecha_apertura: string
  fecha_cierre: string | null
  efectivo_esperado: number | null
  efectivo_contado: number | null
  descuadre: number | null
  total_ventas: number | null
  total_efectivo: number | null
  total_tarjeta: number | null
  total_tickets: number | null
  notas: string | null
  estado: EstadoTurno
  created_at: string
  abierto_por_nombre?: string
  cerrado_por_nombre?: string
}

export interface AbrirTurnoPayload {
  fondo_inicial: number
}

export interface CerrarTurnoPayload {
  efectivo_contado: number
  notas?: string
}
```

---

## API Routes

Todas las rutas:
- Usan `createClient()` de `@/lib/supabase/server`
- Obtienen `restaurant_id` via `supabase.from('users').select('restaurant_id').eq('auth_id', user.id).single()`
- Devuelven 401 si no hay usuario autenticado
- Devuelven JSON con `{ error: string }` en caso de error

### GET `/api/caja/turno-activo`

Devuelve el turno abierto actual o `null`.

Query:
```sql
SELECT tc.*, ua.nombre as abierto_por_nombre
FROM turnos_caja tc
JOIN users ua ON ua.id = tc.abierto_por
WHERE tc.restaurant_id = <restaurantId>
AND tc.estado = 'abierto'
LIMIT 1
```

Respuesta: `{ turno: TurnoCaja | null }`

### POST `/api/caja/abrir`

Body: `{ fondo_inicial: number }`

1. Verifica que no hay turno abierto ya → 400 si lo hay
2. Obtiene `users.id` (no `auth_id`) del usuario actual
3. Inserta en `turnos_caja` con `estado = 'abierto'`

Respuesta: `{ turno: TurnoCaja }` con status 201

### POST `/api/caja/cerrar`

Body: `{ efectivo_contado: number, notas?: string }`

1. Obtiene el turno abierto actual → 400 si no hay
2. Calcula resumen del turno con JOIN a `payments`:

```sql
SELECT
  COUNT(DISTINCT t.id)                                                      AS total_tickets,
  COALESCE(SUM(t.total), 0)                                                 AS total_ventas,
  COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END), 0)   AS total_efectivo,
  COALESCE(SUM(CASE WHEN p.method != 'cash' THEN p.amount ELSE 0 END), 0)  AS total_tarjeta
FROM tickets t
LEFT JOIN payments p ON p.ticket_id = t.id
WHERE t.restaurant_id = <restaurantId>
AND t.issued_at >= <turno.fecha_apertura>
```

Nota: para pagos mixtos, `payments` tiene dos filas (una `cash`, una `card`), lo que captura la división exacta.

3. Calcula:
   - `efectivo_esperado = fondo_inicial + total_efectivo`
   - `descuadre = efectivo_contado - efectivo_esperado`

4. Actualiza `turnos_caja`: estado='cerrado', fecha_cierre=now(), cerrado_por, todos los totales

Respuesta: `{ turno: TurnoCaja }`

### GET `/api/caja/historial`

Query params: `pagina` (default 1), `limite` (default 20)

```sql
SELECT tc.*,
  ua.nombre as abierto_por_nombre,
  uc.nombre as cerrado_por_nombre
FROM turnos_caja tc
JOIN users ua ON ua.id = tc.abierto_por
LEFT JOIN users uc ON uc.id = tc.cerrado_por
WHERE tc.restaurant_id = <restaurantId>
AND tc.estado = 'cerrado'
ORDER BY tc.fecha_apertura DESC
LIMIT <limite> OFFSET <(pagina-1)*limite>
```

Respuesta: `{ data: TurnoCaja[], total: number, pagina: number, limite: number }`

---

## Server Component: `app/dashboard/caja/page.tsx`

1. `createClient()` → `supabase.auth.getUser()` → redirect('/login') si no hay usuario
2. Obtiene `restaurant_id` y rol del usuario (mismo patrón que `app/dashboard/finanzas/page.tsx`)
3. Solo accesible para roles `admin` y `gerente` → si no, muestra mensaje de error con botón volver
4. Consulta Supabase directamente (no via API routes, para evitar URLs absolutas y saltos innecesarios — mismo patrón que Finanzas):
   - Turno activo: `turnos_caja` con JOIN a `users` para nombre
   - Historial: primeras 20 filas de `turnos_caja` cerrados con JOIN a `users`
5. Renderiza `<AppShell title="Caja">` con `<CajaClient>` pasando: `turnoActivo`, `historial`, `usuarioId`

Las API routes se usan únicamente desde el Client Component para mutaciones y recargas posteriores.

---

## Client Component: `components/caja/CajaClient.tsx`

`'use client'`. Props: `turnoActivo: TurnoCaja | null`, `historial: TurnoCaja[]`, `usuarioId: string`

### Estado

```typescript
const [turno, setTurno] = useState(turnoActivo)
const [historial, setHistorial] = useState(historialInicial)
const [vista, setVista] = useState<'actual' | 'historial'>('actual')
const [fondoInicial, setFondoInicial] = useState(0)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [modalCierre, setModalCierre] = useState(false)
const [efectivoContado, setEfectivoContado] = useState('')
const [notasCierre, setNotasCierre] = useState('')
const [pagina, setPagina] = useState(1)
```

### Vista "Turno actual" — sin turno

- Icono grande de caja (emoji `🏧` o similar)
- Título "Sin turno activo", subtítulo descriptivo
- Campo numérico "Fondo inicial de caja (€)"
- Botón "Abrir turno" → POST `/api/caja/abrir` → actualiza `turno` en estado

### Vista "Turno actual" — con turno

- Badge verde "Turno abierto"
- Hora de apertura + nombre del usuario que abrió
- Fondo inicial
- 4 tarjetas de métricas (fetcha de `/api/caja/turno-activo` para tener datos actualizados):
  - Total vendido, En efectivo, En tarjeta, Nº tickets
- Botón rojo "Cerrar turno" → abre `modalCierre`

### Modal de cierre

Overlay con div centrado. No usa `<form>`.

- Título "Cierre de turno"
- Muestra total ventas y efectivo esperado (fondo_inicial + total_efectivo del turno)
- Campo "Efectivo contado en caja (€)"
- Diferencia dinámica: `efectivoContado - efectivoEsperado` con color verde (≥0) o rojo (<0)
- Campo textarea "Notas (opcional)"
- Botones "Cancelar" y "Confirmar cierre"
- Al confirmar → POST `/api/caja/cerrar` → cierra modal, setTurno(null), prepende turno cerrado al historial

### Vista "Historial"

Tabla con columnas: Apertura, Cierre, Abierto por / Cerrado por, Ventas, Efectivo, Tarjeta, Tickets, Descuadre.

- Descuadre: verde si = 0, rojo si < 0, amarillo si > 0
- Cada fila tiene botón "Ver detalle" que expande inline el desglose completo
- Paginación con botones "Anterior" / "Siguiente", cada cambio llama a GET `/api/caja/historial?pagina=N`

### Navegación (dos pestañas en cabecera)

```tsx
<button onClick={() => setVista('actual')}>Turno actual</button>
<button onClick={() => setVista('historial')}>Historial</button>
```

---

## NavDrawer

Añadir a `NAV_ITEMS` en `components/NavDrawer.tsx`:

```typescript
{ href: '/dashboard/caja', label: 'Caja', icon: '🏦' }
```

La entrada es visible para todos en el drawer, pero la página en sí restringe el acceso por rol. No se modifica la lógica del NavDrawer (no tiene sistema de permisos por rol actualmente).

---

## Dashboard principal

Añadir tarjeta "Caja" al array `NAV_CARDS` en `app/dashboard/page.tsx`:

```typescript
{
  href: '/dashboard/caja',
  icon: '🏦',
  label: 'Caja',
  description: 'Turnos, apertura y cierre de caja',
  color: 'bg-[var(--bg-surface)] border-green-500/40 hover:bg-[var(--bg-surface-hover)]',
  iconBg: 'bg-green-500/15',
  labelColor: 'text-green-600',
  modulo: 'administracion',
}
```

Usa el módulo `administracion` ya existente (admin + gerente) para que solo ellos lo vean.

---

## Archivos a crear/modificar

| Acción | Archivo |
|---|---|
| CREAR | `types/caja.ts` |
| CREAR | `app/api/caja/turno-activo/route.ts` |
| CREAR | `app/api/caja/abrir/route.ts` |
| CREAR | `app/api/caja/cerrar/route.ts` |
| CREAR | `app/api/caja/historial/route.ts` |
| CREAR | `app/dashboard/caja/page.tsx` |
| CREAR | `components/caja/CajaClient.tsx` |
| MODIFICAR | `components/NavDrawer.tsx` |
| MODIFICAR | `app/dashboard/page.tsx` |

---

## Restricciones técnicas

- Todos los textos en español
- Sin `<form>` — usar divs con `onClick`/`onChange`
- Sin `lucide-react` (no instalado) — usar emojis
- Client Components usan `fetch()` a las API routes, no el cliente Supabase directamente
- Server Components y API routes usan `createClient()` de `@/lib/supabase/server`
- La columna de nombre en `users` es `nombre` (no `full_name`)
- `get_current_restaurant_id()` solo en RLS; en código, obtener `restaurant_id` explícitamente via `users` table
