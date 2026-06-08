# Tickets — Limpieza e historial en Finanzas

**Fecha:** 2026-06-08
**Estado:** Aprobado

---

## Contexto

La sesión anterior implementó el flujo base de tickets: al cobrar en el TPV aparece un modal `TicketPreview` con PDF, impresión térmica e impresión por navegador. Los archivos ya existen y están comprometidos. Este spec cubre dos cosas pendientes:

- **Parte B:** limpiar la implementación existente (eliminar `comensales`, añadir `estado?`)
- **Parte A:** añadir historial de tickets como segunda pestaña en `/dashboard/finanzas`

---

## Parte B — Limpieza de implementación existente

### Cambios en tipos (`types/ticket.ts`)

- Eliminar campo `comensales` de `TicketCompleto` (la tabla `orders` no tiene esa columna; en `reservations` existe como `party_size` pero no aplica aquí)
- Añadir campo opcional `estado?: string`
- Añadir nueva interfaz `TicketResumen` para la lista del historial

```typescript
export interface TicketCompleto {
  id: string
  numero_ticket: string
  fecha: string
  mesa_nombre: string
  subtotal: number
  iva: number
  total: number
  metodo_pago: string
  estado?: string
  hash_verifactu?: string
  qr_verifactu?: string
  restaurante: {
    nombre: string
    direccion?: string
    nif?: string
    telefono?: string
  }
  items: {
    id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    producto: { nombre: string }
  }[]
}

export interface TicketResumen {
  id: string
  numero_ticket: string
  fecha: string        // issued_at ISO string
  total: number
  metodo_pago: string
  mesa_nombre: string
}
```

### Archivos a actualizar

| Archivo | Cambio |
|---|---|
| `types/ticket.ts` | Reemplazar interfaz completa; añadir `TicketResumen` |
| `app/api/tickets/[ticketId]/pdf/route.tsx` | Eliminar referencia a `comensales: 0` en `fetchTicketData` y en el PDF |
| `components/tpv/TicketPreview.tsx` | Eliminar referencia a `comensales: 0` en `fetchTicket` |

---

## Parte A — Historial de tickets en Finanzas

### Arquitectura general

La página `/dashboard/finanzas` pasa de una sola vista a dos pestañas:

```
[ Movimientos ]  [ Tickets ]
```

El filtro de período existente (Este mes / Mes anterior / Últimos 3 meses / Este año / Todo) se comparte entre ambas pestañas:
- En **Movimientos**: comportamiento actual sin cambios (afecta solo a los KPIs del resumen)
- En **Tickets**: filtra la lista por `issued_at` del ticket

Los KPIs (Ingresos TPV, Ingresos manuales, Gastos, Beneficio neto) se mantienen visibles en ambas pestañas — son resumen global, no por pestaña.

### Fetch de datos (server component)

`app/dashboard/finanzas/page.tsx` añade una consulta para el historial:

```typescript
supabase
  .from('tickets')
  .select('id, ticket_number, issued_at, total, payment_method, orders(tables(name))')
  .eq('restaurant_id', restaurantId)
  .order('issued_at', { ascending: false })
```

El join `orders → tables` da el nombre de mesa. Si la orden o la mesa no existen, se usa `'Mesa'` como fallback.

El resultado se mapea a `TicketResumen[]` y se pasa a `FinanzasClient` como nueva prop `tickets`.

### Tab "Tickets" — contenido

Lista tabular con las columnas:

| Nº Ticket | Fecha | Mesa | Método de pago | Total | — |
|---|---|---|---|---|---|
| A-00000001 | 08/06/2026 14:32 | Mesa 3 | Tarjeta | 42,50 € | [Ver ticket] |

- **Filtro de período:** los tickets se filtran por `issued_at` en el rango del período seleccionado
- **Botón "Ver ticket":** abre `<TicketPreview ticketId={id} onClose={...} />` en modal (componente ya existe)
- **Estado vacío:** si no hay tickets en el período, muestra un mensaje centrado `"No hay tickets en este período"`
- **Método de pago:** mostrar etiqueta legible: `cash → Efectivo`, `card → Tarjeta`, `bizum → Bizum`, `mixed → Mixto`

### Cambios en `FinanzasClient`

- Nueva prop: `tickets: TicketResumen[]`
- Nuevo estado: `tab: 'movimientos' | 'tickets'` (default `'movimientos'`)
- Nuevo estado: `ticketModalId: string | null` (para abrir `TicketPreview`)
- Los dos botones de tab se renderizan entre el filtro de período y los KPIs
- El contenido debajo de los KPIs y el gráfico se condicionan por `tab`:
  - `movimientos`: lista actual + botones añadir + modal de movimiento (sin cambios)
  - `tickets`: lista filtrada + `TicketPreview` si `ticketModalId !== null`

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `types/ticket.ts` | Añadir `TicketResumen` (ya cubierto en Parte B) |
| `app/dashboard/finanzas/page.tsx` | Fetch `TicketResumen[]`; pasar como prop `tickets` |
| `components/finanzas/FinanzasClient.tsx` | Nueva prop `tickets`, tab UI, lista Tickets, apertura de modal |

---

## Restricciones y decisiones

- **Sin nuevas dependencias** — `TicketPreview` ya está implementado con sus propias dependencias
- **`comensales` eliminado** — la tabla `orders` no tiene esa columna; no se pide al cerrar mesa
- **`estado`** — campo opcional, no se muestra en el PDF actual ni en la lista; queda disponible para futuro (p.ej. anulaciones)
- **RLS en tickets** — el fetch del server component usa el cliente autenticado por cookie (mismo patrón que el resto de la página); el `supabaseAdmin` en las API routes de PDF/print ya cubre esa ruta
- **Mesa nombre** — se obtiene via join `tickets → orders → tables`; si la relación falla se usa `'Mesa'` como fallback
- **SQL migrations** — los campos `hash_verifactu` y `qr_verifactu` en la tabla `tickets` son opcionales en el código (optional chaining); si no existen en la BD, no rompe nada

---

## Archivos afectados (resumen)

| Archivo | Acción |
|---|---|
| `types/ticket.ts` | MODIFICAR |
| `app/api/tickets/[ticketId]/pdf/route.tsx` | MODIFICAR |
| `components/tpv/TicketPreview.tsx` | MODIFICAR |
| `app/dashboard/finanzas/page.tsx` | MODIFICAR |
| `components/finanzas/FinanzasClient.tsx` | MODIFICAR |
