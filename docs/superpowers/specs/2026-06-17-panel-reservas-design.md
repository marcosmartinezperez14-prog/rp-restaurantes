# Panel de Reservas — Dashboard

**Fecha:** 2026-06-17  
**Estado:** Aprobado

## Objetivo

Proporcionar a admin y gerente una interfaz para ver, filtrar, confirmar, editar y eliminar las reservas recibidas desde el formulario público.

## Arquitectura

### Ficheros nuevos

| Fichero | Tipo | Responsabilidad |
|---|---|---|
| `app/dashboard/reservas/page.tsx` | Server Component | Auth check, carga inicial de reservas, pasa props a ReservasView |
| `components/reservas/ReservasView.tsx` | Client Component | Tabla filtrable, modales de edición, acciones sobre reservas |
| `app/api/reservas/[id]/route.ts` | API Route | PATCH (editar campos / cambiar estado) + DELETE |

### Patrón seguido

Mismo patrón que `app/dashboard/equipo/page.tsx` + `components/equipo/EquipoClient.tsx`: el Server Component carga los datos SSR y los pasa como prop; el Client Component gestiona la interactividad sin recargar la página.

## Página servidor (`app/dashboard/reservas/page.tsx`)

1. Verifica sesión con `createClient()` — redirige a `/login` si no hay usuario.
2. Obtiene `restaurant_id` y rol del usuario actual.
3. Si el rol no es `admin` ni `gerente`, muestra mensaje de acceso denegado dentro de `AppShell`.
4. Carga reservas del restaurante con `supabaseAdmin` (todas, sin filtro de fecha — el filtrado ocurre en cliente).
5. Renderiza `<AppShell title="Reservas"><ReservasView reservas={reservas} /></AppShell>`.

## Componente cliente (`components/reservas/ReservasView.tsx`)

### Estado interno

- `reservas` — lista local (copia mutable de las props iniciales)
- `filtroFecha` — string YYYY-MM-DD, por defecto hoy
- `filtroEstado` — `'all' | 'pending' | 'confirmed' | 'cancelled'`, por defecto `'all'`
- `modalEditar` — reserva seleccionada para editar o `null`
- `cargando` — booleano para feedback en acciones

### Filtrado

Aplicado en el cliente sobre `reservas`:
- Por `reservation_date === filtroFecha`
- Por `status === filtroEstado` (si no es `'all'`)
- Ordenado por `reservation_time ASC`

### Tabla

Columnas: Fecha · Hora · Nombre · Comensales · Teléfono · Email · Estado · Acciones

**Badges de estado:**
- `pending` → fondo amarillo claro, texto amarillo oscuro — "Pendiente"
- `confirmed` → fondo verde claro, texto verde — "Confirmada"
- `cancelled` → fondo rojo claro, texto rojo — "Cancelada"

**Acciones por fila:**
- Confirmar (solo si `pending`) — llama `PATCH` con `{ status: 'confirmed' }`, actualiza estado local optimistamente
- Cancelar (si `pending` o `confirmed`) — llama `PATCH` con `{ status: 'cancelled' }`
- Editar (lápiz) — abre modal de edición
- Eliminar (papelera) — `confirm()` → `DELETE` → elimina fila del estado local

### Modal de edición

Campos editables:
- `reservation_date` (type="date")
- `reservation_time` (type="time")
- `party_size` (type="number", min=1, max=99)
- `notes` (textarea)

Campos de solo lectura (mostrados pero no editables): nombre, teléfono, email.

Al guardar: `PATCH /api/reservas/[id]` con los campos modificados. Actualiza el estado local y cierra el modal.

### Nueva reserva

Botón "Nueva reserva" en la barra de filtros. Abre el mismo modal de edición pero vacío. Al guardar hace `POST /api/reservas` (nueva API route para creación manual — fuera del alcance de esta spec; el botón puede omitirse en la primera versión).

> **Decisión de alcance:** El botón "Nueva reserva" se omite en v1. Solo gestión de reservas existentes.

## API Route (`app/api/reservas/[id]/route.ts`)

### PATCH

Schema Zod:
```ts
z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  party_size: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(500).optional(),
})
```

Validaciones:
1. Caller autenticado con rol `admin` o `gerente`.
2. La reserva existe y pertenece al `restaurant_id` del caller (aislamiento multi-tenant).
3. Al menos un campo presente en el body.

Responde: `{ data: reservaActualizada }` o error con código apropiado.

### DELETE

Validaciones:
1. Caller autenticado con rol `admin` o `gerente`.
2. La reserva pertenece al `restaurant_id` del caller.

Responde: `{ ok: true }`.

## Tabla en base de datos

`reservations` (existente, sin cambios de esquema):

| Columna | Tipo | Uso |
|---|---|---|
| id | uuid | PK |
| restaurant_id | uuid | Aislamiento tenant |
| customer_name | text | Mostrado en tabla |
| customer_phone | text | Mostrado en tabla |
| customer_email | text | Mostrado en tabla |
| party_size | int | Editable |
| reservation_date | date | Editable, filtro |
| reservation_time | time | Editable |
| status | text | `pending` / `confirmed` / `cancelled` |
| notes | text | Editable |

## Acceso y permisos

- Solo `admin` y `gerente` pueden acceder.
- La page server muestra mensaje de denegación para otros roles (no redirige).
- La API route devuelve 403 si el rol no es `admin` o `gerente`.

## Lo que NO entra en esta versión

- Creación manual de reservas desde el panel
- Notificaciones por email al cliente al confirmar/cancelar
- Paginación (se filtra por fecha, el volumen por día es manejable)
- Exportación a CSV
