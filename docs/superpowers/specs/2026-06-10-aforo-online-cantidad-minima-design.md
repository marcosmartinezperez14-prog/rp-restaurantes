# Aforo Online + Cantidad Mínima — Design Spec

**Fecha:** 2026-06-10  
**Stack:** Next.js App Router, Supabase, TypeScript, Tailwind CSS  
**Migración SQL ya aplicada:** `restaurants.max_online_comensales` (integer, nullable) y `menu_items.cantidad_minima` (integer, default 1)

---

## Objetivo

Dos mejoras independientes:

1. **Regla de aforo online** — el admin configura un límite de comensales a partir del cual el cliente debe llamar por teléfono en lugar de continuar online (reserva o navegación de carta).
2. **Cantidad mínima por pedido** — cada plato de la carta puede tener un mínimo de unidades por pedido, aplicado en el flujo de pedido desde mesa.

---

## Contexto del proyecto

- El área cliente tiene dos flujos distintos:
  - `/cliente/[slug]` — carta pública SSR (solo lectura, con botón "Reservar mesa")
  - `/cliente/[slug]/mesa/[mesa_id]` — pedido desde mesa (client component, carrito + envío)
  - `/cliente/[slug]/reservas` — formulario de reserva pública (client component)
- No existe un tipo `Restaurant` centralizado; cada query selecciona los campos necesarios.
- La página de administración (`/dashboard/administracion`) ya tiene `ReservasConfigPanel`; es el lugar natural para configuración de restaurante.
- `/cliente/[slug]/page.tsx` es SSR puro — la carta se renderiza en servidor. El gate de comensales se implementa como un wrapper client `CartaGate` que recibe `maxOnlineComensales` como prop.

---

## Feature 1 — Regla de aforo online

### Dashboard

**`app/actions/administracion.ts`**  
Añadir dos server actions:

- `getAforoOnline(): Promise<number | null>` — lee `restaurants.max_online_comensales` del restaurante del usuario autenticado. Devuelve `null` si no hay fila en `reservation_settings` o el campo es NULL.
- `guardarAforoOnline(max: number | null): Promise<{ ok?: boolean; error?: string }>` — hace PATCH directo a `restaurants` actualizando `max_online_comensales`. Si `max` es 0 o negativo, guarda NULL.

**`components/administracion/AforoOnlinePanel.tsx`** (nuevo)  
Client component. Patrón idéntico a `ReservasConfigPanel`:
- Input numérico, label: "A partir de __ comensales, requerir llamada telefónica"
- Vacío o 0 → sin límite (guarda NULL)
- Botón "Guardar" que llama a `guardarAforoOnline`
- Toast de confirmación / mensaje de error inline

**`app/dashboard/administracion/page.tsx`**  
Añadir `<AforoOnlinePanel initialMax={...} />` debajo de `<ReservasConfigPanel>`. Leer el valor con `getAforoOnline()` en el server component.

### Área cliente

**`app/api/cliente/[slug]/route.ts`**  
Ampliar el select de `restaurants` para incluir `max_online_comensales`. Devolver el campo en la respuesta JSON.

**`app/cliente/[slug]/page.tsx`** (SSR)  
En el select del restaurante, incluir `max_online_comensales`. Pasar el valor al nuevo `<CartaGate>` como prop.

**`components/cliente/CartaGate.tsx`** (nuevo)  
Client component:
- Props: `maxOnlineComensales: number | null`, `children: React.ReactNode`
- Si `maxOnlineComensales === null` → renderiza children directamente (sin gate)
- Si está configurado → muestra stepper de comensales (botones − y + sobre un contador, mínimo 1)
- Cuando el usuario elige un número:
  - `comensales < maxOnlineComensales` → muestra children (la carta)
  - `comensales >= maxOnlineComensales` → muestra mensaje: "Para grupos de [N] o más personas, contacta con nosotros por teléfono."
- Sin número elegido aún → muestra el stepper y un botón "Continuar"

**`app/cliente/[slug]/reservas/page.tsx`**  
- Al montar, fetch a `GET /api/cliente/[slug]` para obtener `max_online_comensales`
- En `handleEnviar`: si `maxOnlineComensales !== null` y `numPersonas >= maxOnlineComensales` → `setError("Para grupos de N o más personas, contacta con nosotros por teléfono.")`, no enviar.

---

## Feature 2 — Cantidad mínima por pedido

### Dashboard (tipo + acciones + formulario)

**`app/actions/productos.ts`**

Tipo `MenuItem`:
```ts
cantidad_minima: number  // añadir
```

`getMenuItems()`: incluir `cantidad_minima` en el select de `menu_items`. Mapear con `Number(item.cantidad_minima) ?? 1`.

`createMenuItem()`: añadir param `cantidadMinima?: number` (default 1). Incluir `cantidad_minima: params.cantidadMinima ?? 1` en el insert.

`updateMenuItem()`: añadir param `cantidadMinima?: number`. Si está presente: `updateData.cantidad_minima = params.cantidadMinima`.

**`components/carta/MenuItemFormPanel.tsx`**  
- Estado: `const [cantidadMinima, setCantidadMinima] = useState(item?.cantidad_minima ?? 1)`
- Añadir campo antes del botón Guardar: input numérico (min 1, step 1), label "Cantidad mínima por pedido"
- Incluir `cantidadMinima` en el payload de `createMenuItem` / `updateMenuItem`

### API pública (área cliente)

**`app/api/cliente/[slug]/carta/route.ts`**  
Tipo `ItemCarta`:
```ts
cantidad_minima: number  // añadir
```
Select: incluir `cantidad_minima`. Mapear en el objeto devuelto.

**`app/api/cliente/[slug]/mesa/[mesa_id]/route.ts`** (GET)  
- Select `menu_items`: incluir `cantidad_minima`
- Carta que se devuelve: cada item incluye `cantidad_minima: Number(item.cantidad_minima) ?? 1`

### Área cliente — mesa ordering

**`app/cliente/[slug]/mesa/[mesa_id]/page.tsx`**

Tipo `ItemCarrito`:
```ts
type ItemCarrito = ItemCarta & { cantidad: number }
// ItemCarta ya tendrá cantidad_minima tras el cambio en la API
```

`añadir(item)`:
- Si el item ya está en carrito → `cantidad + 1`
- Si es nuevo → `cantidad = item.cantidad_minima` (no 1)

`quitar(itemId)`:
- Si `item.cantidad === item.cantidad_minima` → eliminar del carrito (ir a 0)
- Si `item.cantidad > item.cantidad_minima` → decrementar

El botón `−` al llegar al mínimo visualmente elimina el plato (comportamiento ya existente, solo que el umbral es `cantidad_minima` en lugar de 1).

Validación defensiva en `handleEnviarPedido` (antes del fetch): si algún ítem tiene `cantidad < cantidad_minima`, mostrar `setErrorEnvio("Este plato tiene un mínimo de N unidad(es) por pedido.")` y no enviar. En la práctica el stepper ya lo garantiza; es una red de seguridad.

---

## Restricciones

- No crear tablas nuevas (solo columnas ya migradas)
- No modificar políticas RLS
- Todo el texto de UI en español
- No usar etiquetas `<label>` — usar divs con onClick
- Respetar patrones existentes (server actions con `createClient`, client components con `createClient` del cliente)

---

## Archivos modificados / creados

| Acción | Archivo |
|---|---|
| MODIFICAR | `app/actions/administracion.ts` |
| CREAR | `components/administracion/AforoOnlinePanel.tsx` |
| MODIFICAR | `app/dashboard/administracion/page.tsx` |
| MODIFICAR | `app/api/cliente/[slug]/route.ts` |
| MODIFICAR | `app/cliente/[slug]/page.tsx` |
| CREAR | `components/cliente/CartaGate.tsx` |
| MODIFICAR | `app/cliente/[slug]/reservas/page.tsx` |
| MODIFICAR | `app/actions/productos.ts` |
| MODIFICAR | `components/carta/MenuItemFormPanel.tsx` |
| MODIFICAR | `app/api/cliente/[slug]/carta/route.ts` |
| MODIFICAR | `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts` |
| MODIFICAR | `app/cliente/[slug]/mesa/[mesa_id]/page.tsx` |
