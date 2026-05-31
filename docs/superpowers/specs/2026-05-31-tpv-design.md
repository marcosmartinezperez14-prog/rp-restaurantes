# TPV (Terminal Punto de Venta) — Design Spec

**Fecha:** 2026-05-31  
**Estado:** Aprobado por el usuario

---

## 1. Resumen

Sistema TPV completo para gestión de mesas, comandas y cobros. Optimizado para tablet en horizontal (táctil). Interfaz limpia y sobria: fondo `#f4f6f9`, tarjetas blancas, azul institucional `#2563eb` para acciones primarias.

---

## 2. Sistema de diseño

### Paleta de colores

| Token | Valor | Uso |
|---|---|---|
| `bg-app` | `#f4f6f9` | Fondo general |
| `surface` | `#ffffff` | Tarjetas y paneles |
| `border` | `#e2e8f0` | Bordes sutiles |
| `text-primary` | `#0f172a` | Títulos |
| `text-secondary` | `#64748b` | Subtítulos y labels |
| `text-muted` | `#94a3b8` | Texto terciario |
| `action` | `#2563eb` | Botón primario / selección activa |
| `status-free` | `#22c55e` / `#bbf7d0` | Mesa libre |
| `status-occupied` | `#ef4444` / `#fca5a5` | Mesa ocupada |
| `status-reserved` | `#eab308` / `#fde68a` | Mesa reservada |
| `status-billing` | `#3b82f6` / `#93c5fd` | Mesa cobrando |
| `confirm` | `#15803d` | Botón confirmar cobro |

### Tipografía
- Fuente: `Segoe UI, system-ui, -apple-system, sans-serif` (hereda del layout raíz)
- Botones de acción: mínimo 44px de alto, `font-weight: 700`
- Precio total en cobro: `font-size: 36px, font-weight: 900`

### Componentes base
- **Badge de estado**: `border-radius: 4px`, texto en uppercase, 10px, fondo tenue del color del estado
- **Tarjeta de mesa**: `border-radius: 10px`, `border: 1.5px`, mínimo 90×90px
- **Botón primario**: `border-radius: 8px`, azul `#2563eb`
- **Botón confirmar cobro**: verde `#15803d`

---

## 3. Páginas y componentes

### 3.1 Mapa de mesas — `app/tpv/page.tsx`

**Tipo:** Server Component (carga inicial) + `TableMap` Client Component (Realtime)

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Nav: "RP Restaurantes · TPV"  [Actualizar] [Dashboard] │
├─────────────────────────────────────────────┤
│ Stats: [4 Ocupadas] [6 Libres] [1 Cobrando]  │
│                                             │
│ ── SALÓN ─────────────────────────────────  │
│ [Mesa 1 / Ocupada] [Mesa 2 / Libre] ...      │
│                                             │
│ ── TERRAZA ────────────────────────────────  │
│ [T-1 / Ocupada] [T-2 / Libre] ...            │
└─────────────────────────────────────────────┘
```

**Server Component (`page.tsx`):**
- Obtiene el `restaurantId` del usuario autenticado
- Llama a `getZonesWithTables(restaurantId)` para la carga inicial
- Renderiza `<TableMap initialData={...} restaurantId={...} />`

**Client Component (`TableMap.tsx`):**
- Recibe `initialData` como prop, la almacena en `useState`
- Se suscribe a cambios en `tables` via Supabase Realtime (canal: `tpv:tables:{restaurantId}`)
- Al recibir un evento, actualiza sólo la mesa afectada en el estado local
- Al clic en mesa `free` o `reserved`: llama `createOrder(tableId)` → navega a `/tpv/comanda/[orderId]`
- Al clic en mesa `occupied` o `billing`: llama `getOpenOrder(tableId)` → navega a `/tpv/comanda/[orderId]`
- Botón "Actualizar" llama `getZonesWithTables()` manualmente y reemplaza el estado

**Tarjeta de mesa muestra:**
- Nombre de la mesa (`tables.name`)
- Capacidad (`tables.capacity` + texto "personas")
- Badge de estado con color
- Si `occupied` o `billing`: tiempo abierto (calculado desde `orders.opened_at`) y total acumulado (`orders.total`)

**Filtros de datos:**
- Solo zonas con `is_active = true` y `deleted_at IS NULL`
- Solo mesas con `is_active = true` y `deleted_at IS NULL`

---

### 3.2 Vista de comanda — `app/tpv/comanda/[orderId]/page.tsx`

**Tipo:** Server Component + Client Components

**Layout (pantalla completa, sin scroll exterior):**
```
┌──────────────────────────────────────────────────────┐
│ Nav: [← Mapa]  TPV › Mesa 1                         │
├───────────────────────────┬──────────────────────────┤
│  PANEL PRODUCTOS (60%)    │  PANEL COMANDA (40%)     │
│                           │                          │
│  [Buscar producto...]     │  Mesa 1                  │
│  [Todas][Entrantes][...]  │  Abierta 45 min · #0042  │
│                           │ ─────────────────────── │
│  Grid de productos:       │  Paella ×2    29,00 €   │
│  [Ensalada César  9,50]  │    · Para 2 pers          │
│  [Croquetas       7,00]  │    [−][2][+]  [🗑]       │
│  [Paella         14,50]  │    [nota para cocina]     │
│  [AGOTADO       22,00]   │                          │
│  ...                      │  Subtotal     44,83 €   │
│                           │  IVA (10%)     4,48 €   │
│                           │  IVA (21%)     0,26 €   │
│                           │  ─────────────────────  │
│                           │  TOTAL        47,50 €   │
│                           │                          │
│                           │  [Cobrar — 47,50 €]     │
│                           │  [Cancelar comanda]      │
└───────────────────────────┴──────────────────────────┘
```

**Server Component (`page.tsx`):**
- Verifica que el `orderId` pertenece al restaurante del usuario
- Carga en paralelo: orden, items, productos con modificadores, zonas/mesas
- Renderiza `<OrderView order={...} products={...} />` 

**Client Component (`OrderView.tsx`):**
- Gestiona estado local de los items de la comanda
- Panel izquierdo: `ProductsPanel` (categorías, búsqueda, grid)
- Panel derecho: `OrderPanel` (items, totales, acciones)

**ProductsPanel:**
- Tabs de categorías (scroll horizontal, sin wrap)
- "Todas" como primera opción activa por defecto
- Buscador filtra por `products.name` en tiempo real (sin servidor)
- Productos con `is_available = false` se muestran con `opacity: 0.4` y badge "No disponible" — son pulsables pero muestran un toast de advertencia
- Productos con `is_visible = false`: no se muestran
- Productos con `deleted_at IS NOT NULL`: no se muestran
- Al pulsar un producto **sin modificadores**: llama `addOrderItem()` directamente
- Al pulsar un producto **con modificadores**: abre `<ModifierModal />`

**OrderPanel:**
- Lista de items con `status !== 'cancelled'`
- Cada item: nombre, modificadores (texto compacto), cantidad editable, precio total, botón eliminar
- Input de nota por item (campo pequeño, placeholder "Nota para cocina...")
- Totales calculados en cliente desde los items (subtotal, IVA agrupado por `tax_rate`, total)
- Botón "Cobrar" fijo en la parte inferior, siempre visible aunque haya scroll en la lista
- "Cancelar comanda" solo visible si ningún item tiene `status: 'served'` o `status: 'ready'`
- Botón Cobrar navega a `/tpv/cobro/[orderId]`

---

### 3.3 Modal de modificadores — `ModifierModal.tsx`

**Tipo:** Client Component (overlay)

**Comportamiento:**
- Se abre sobre la vista de comanda con overlay semitransparente
- Muestra nombre del producto y "Selecciona las opciones"
- Grupos ordenados por `product_modifier_groups.position`
- Opciones filtradas: `is_active = true` y `deleted_at IS NULL`, ordenadas por `position`

**Por grupo:**
- Badge "Obligatorio · X opción(es)" (rojo) o "Opcional · hasta X" (verde)
- Grupos con `max_selections = 1` o `is_required = true` con `max_selections = 1`: radio buttons (selección única)
- Grupos con `max_selections > 1`: checkboxes (selección múltiple hasta el límite)
- Si se intenta seleccionar más del límite: no permite la selección (sin animación llamativa)
- Precio de opción: muestra `+X,XX €` si `price_adjustment > 0`, `—` si es 0

**Footer:**
- Total en tiempo real: `product.price + sum(selected options price_adjustment)`
- Botón "Añadir a la comanda" — deshabilitado si hay grupos obligatorios sin seleccionar
- Al confirmar: llama `addOrderItem()` con los modificadores seleccionados como array de `{ option_id, name, price_adjustment }`

---

### 3.4 Pantalla de cobro — `app/tpv/cobro/[orderId]/page.tsx`

**Tipo:** Server Component + `PaymentForm` Client Component

**Layout:**
```
┌─────────────────────────────────────┐
│ Nav: [← Comanda]  Cobro — Mesa 1   │
├─────────────────────────────────────┤
│ Total:  47,50 €                     │
│                                     │
│ Resumen: item × qty ......... X,XX  │
│ ─────────────────────────────────── │
│ MÉTODO DE PAGO                      │
│ [EFECTIVO] [TARJETA] [BIZUM] [MIXTO]│
│                                     │
│ — Si EFECTIVO:                      │
│   Total ............ 47,50 €        │
│   Entrega cliente  [  50,00]        │
│   Cambio .......... 2,50 €  (verde) │
│                                     │
│ — Si MIXTO:                         │
│   Efectivo  [___]  Tarjeta [___]    │
│   Aviso si no suman el total        │
│                                     │
│ [Confirmar cobro]                   │
└─────────────────────────────────────┘
```

**Server Component:**
- Carga la orden y sus items (verifica `status: 'open'`)
- Si la orden ya está `paid` o `cancelled`, redirige al mapa
- Carga datos del restaurante (`name`, `nif`, `address`) para el ticket

**PaymentForm Client Component:**
- Estado: método seleccionado, importes introducidos
- Cambio calculado en tiempo real: `entrega - total` (solo si > 0)
- Modo MIXTO: dos inputs, validación en tiempo real de que sumen el total
- Botón "Confirmar cobro" deshabilitado si la validación no pasa
- Al confirmar: llama `processPayment()`, muestra spinner, redirige al mapa

---

## 4. Server Actions — `app/actions/tpv.ts`

Todas las funciones obtienen el `restaurantId` del usuario autenticado al inicio. Si no hay sesión o no hay restaurante vinculado → `redirect('/login')`.

### `getZonesWithTables(restaurantId)`
```typescript
returns: ZoneWithTables[]
// Zone: { id, name, color, tables: TableWithOrder[] }
// TableWithOrder: { id, name, capacity, status, openOrder?: { id, total, opened_at } }
```
- Query: zonas activas → mesas activas → LEFT JOIN con orders `status = 'open'`
- Ordenado por `zones.position`, `tables.position`

### `getOpenOrder(tableId)`
```typescript
returns: { orderId: string } | null
```
- Busca `orders` donde `table_id = tableId AND status = 'open' AND deleted_at IS NULL`

### `createOrder(tableId)`
```typescript
returns: { orderId: string }
```
- Inserta en `orders`: `{ restaurant_id, table_id, status: 'open', type: 'dine_in', opened_by: userId, opened_at: now(), order_date: today }`
- Actualiza `tables.status = 'occupied'`
- Devuelve el `orderId` creado

### `getOrderWithItems(orderId)`
```typescript
returns: OrderWithItems
// OrderWithItems: { order, items: OrderItemWithModifiers[], table }
```
- Carga la orden, sus items (`status != 'cancelled'`) y los datos de la mesa

### `getMenuData(restaurantId)`
```typescript
returns: { categories: Category[], products: ProductWithModifiers[] }
// Category: { id: string, name: string }
// ProductWithModifiers: { id, name, price, tax_rate, is_available, category_id, modifierGroups: ModifierGroup[] }
```
- Carga categorías activas y productos activos (`is_visible = true`, `deleted_at IS NULL`) con sus grupos de modificadores y opciones activas
- Ordenados por `categories.position`, `products.position`

### `addOrderItem(orderId, productId, quantity, modifiers, notes?)`
```typescript
// modifiers: { optionId: string, name: string, priceAdjustment: number }[]
returns: { itemId: string }
```
- Lee el producto para obtener snapshot: `product_name`, `product_price`, `tax_rate`
- Calcula `unit_price = product_price + sum(modifiers.priceAdjustment)`
- Calcula `total_price = unit_price * quantity`
- Inserta en `order_items` con el snapshot y el JSON de modificadores
- El trigger de BD recalcula `orders.subtotal`, `orders.tax_amount`, `orders.total`

### `updateOrderItemQuantity(itemId, quantity)`
```typescript
returns: void
```
- Si `quantity <= 0`: llama `removeOrderItem(itemId)`
- Si no: actualiza `quantity` y `total_price = unit_price * quantity`
- Trigger recalcula totales de la orden

### `removeOrderItem(itemId)`
```typescript
returns: void
```
- Actualiza `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = userId`
- Trigger recalcula totales de la orden

### `processPayment(orderId, params)`
```typescript
type PaymentMethod = 'cash' | 'card' | 'bizum' | 'mixed'
type ProcessPaymentParams =
  | { method: 'cash';   cashAmount: number; changeGiven: number }
  | { method: 'card';   amount: number }
  | { method: 'bizum';  amount: number }
  | { method: 'mixed';  cashAmount: number; cardAmount: number }
returns: { ticketId: string }
```

Flujo:
1. Carga la orden y los datos del restaurante
2. Llama `get_next_ticket_number(restaurantId)` → obtiene `sequential_number: integer`
3. Formatea `ticket_number = 'A-' + sequential_number.toString().padStart(8, '0')`
4. Calcula `tax_breakdown` agrupando items por `tax_rate`:
   ```json
   [{ "rate": 10, "base": 40.73, "amount": 4.07 }, { "rate": 21, "base": 1.24, "amount": 0.26 }]
   ```
5. Inserta en `tickets`: `{ restaurant_id, order_id, ticket_number, series: 'A', sequential_number, issuer_name, issuer_nif, issuer_address, issued_at: now(), subtotal, tax_breakdown, tax_total, total, payment_method: method }`
6. Inserta en `payments`: `{ restaurant_id, ticket_id, method, amount: total, change_given: changeGiven ?? 0, processed_by: userId, processed_at: now() }`
7. Para MIXTO: inserta dos filas en `payments` (una por método)
8. Actualiza `orders`: `{ status: 'paid', closed_by: userId, closed_at: now() }`
9. Actualiza `tables.status = 'free'`
10. Devuelve `{ ticketId }`

---

## 5. Realtime — Supabase

**Canal:** `tpv:tables:{restaurantId}` — suscripción a `UPDATE` en `tables`  
**Filtro:** `restaurant_id=eq.{restaurantId}`  
**Eventos escuchados:** `UPDATE` (cambio de status)

Implementado en `TableMap.tsx` con `useEffect`:
```typescript
const channel = supabase
  .channel(`tpv:tables:${restaurantId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'tables',
    filter: `restaurant_id=eq.${restaurantId}`
  }, (payload) => {
    // Actualiza solo la mesa afectada en el estado local
    setZones(prev => /* merge payload.new into the right table */)
  })
  .subscribe()

return () => { supabase.removeChannel(channel) }
```

**Nota:** La suscripción Realtime requiere que la tabla `tables` tenga RLS habilitado y que el usuario tenga política de lectura.

---

## 6. Navegación

```
Dashboard
  └── /tpv                          ← Mapa de mesas
        └── /tpv/comanda/[orderId]  ← Vista de comanda
              └── /tpv/cobro/[orderId]  ← Pantalla de cobro
```

- El proxy (`proxy.ts`) ya protege todas las rutas autenticadas
- `/tpv` y sus subrutas quedan protegidas automáticamente (requieren `sb-onboarding=done`)
- Breadcrumb en nav: texto plano, sin componente externo
- Dashboard añade enlace "Ir al TPV" → `/tpv`

---

## 7. Manejo de errores

- Todos los server actions devuelven `{ error?: string }` en caso de fallo
- Mensajes de error en español, mostrados inline (no toast)
- Loading states: `useTransition` en todos los server actions llamados desde el cliente
- Botones deshabilitados con `disabled={isPending}`
- Si la orden ya no existe o fue pagada: redirige al mapa con `redirect('/tpv')`

---

## 8. Estructura de archivos

```
app/
  tpv/
    page.tsx                        ← SC: carga zonas, renderiza TableMap
    comanda/
      [orderId]/
        page.tsx                    ← SC: carga orden + productos
    cobro/
      [orderId]/
        page.tsx                    ← SC: carga orden para cobro
  actions/
    tpv.ts                          ← Todos los server actions del TPV
components/
  tpv/
    TableMap.tsx                    ← CC: mapa con Realtime
    TableCard.tsx                   ← CC: tarjeta de mesa individual
    OrderView.tsx                   ← CC: vista split de comanda
    ProductsPanel.tsx               ← CC: panel de productos
    OrderPanel.tsx                  ← CC: panel de comanda actual
    ModifierModal.tsx               ← CC: modal de modificadores
    PaymentForm.tsx                 ← CC: formulario de cobro
```

---

## 9. Tipos TypeScript clave

```typescript
// Zona con mesas y su estado
type ZoneWithTables = {
  id: string; name: string; color: string
  tables: TableWithOrder[]
}

type TableWithOrder = {
  id: string; name: string; capacity: number
  status: 'free' | 'occupied' | 'reserved' | 'billing'
  openOrder?: { id: string; total: number; opened_at: string }
}

// Producto con grupos de modificadores
type ProductWithModifiers = {
  id: string; name: string; price: number; tax_rate: number
  is_available: boolean; category_id: string
  modifierGroups: ModifierGroup[]
}

type ModifierGroup = {
  id: string; name: string; is_required: boolean
  min_selections: number; max_selections: number
  options: ModifierOption[]
}

type ModifierOption = {
  id: string; name: string; price_adjustment: number
}

// Selección de modificadores (guardada en order_items.modifiers)
type SelectedModifier = {
  option_id: string; name: string; price_adjustment: number
}

// Método de pago
type PaymentMethod = 'cash' | 'card' | 'bizum' | 'mixed'
```

---

## 10. Restricciones

- No modificar `lib/supabase/server.ts` ni archivos de auth
- Los cálculos de dinero: siempre `Number(value).toFixed(2)`, nunca aritmética flotante directa para mostrar
- El snapshot del producto (name, price, tax_rate) se guarda en `order_items` al añadir, no se referencia dinámicamente
- Los campos VERI*FACTU del ticket (`verifactu_hash`, etc.) se dejan `null` — los rellenará un job externo
- La `series` del ticket es siempre `'A'` por ahora
