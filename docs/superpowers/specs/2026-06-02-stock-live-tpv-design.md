# Stock en vivo, descuento en comandas y edición inline — Design Spec

**Fecha:** 2026-06-02
**Scope:** (1) Stock siempre visible e inline-editable en la tabla de Productos. (2) Descuento automático de stock al añadir ítems a comandas y restauración al eliminar/cancelar.

---

## Objetivo

- El stock de cada producto se muestra directamente en la tabla sin necesidad de abrir ningún modal.
- Se puede editar el stock haciendo clic en el número, escribiendo el nuevo valor y pulsando Enter.
- Cuando se añade un producto a una comanda (TPV), su stock se descuenta automáticamente si tiene `track_stock = true`.
- Cuando se elimina un ítem o se cancela la comanda, el stock se restaura.

---

## Parte 1: Stock inline en Productos

### Nuevo server action `editarStock`

Añadir en `app/actions/productos.ts`:

```typescript
export async function editarStock(
  productId: string,
  newStock: number
): Promise<{ error?: string }> {
```

Lógica:
1. Auth + `restaurantId` (patrón estándar).
2. Fetch `stock` actual del producto (verificando `restaurant_id`).
3. Si producto no encontrado → `{ error: 'Producto no encontrado' }`.
4. Calcular `delta = newStock - (currentStock ?? 0)`.
5. `UPDATE products SET stock = newStock WHERE id = productId AND restaurant_id = restaurantId`.
6. Si `delta !== 0`, insertar en `stock_movements`:
   - `type: 'ajuste'`
   - `quantity: Math.abs(delta)` (siempre positivo)
   - `notes: delta > 0 ? 'Ajuste manual (+)' : 'Ajuste manual (-)'`
   - `cost_price: null`, `purchase_date: null`
7. Devolver `{}` o `{ error }`.

### Cambio en `ProductRow`

La celda de stock cambia de comportamiento:

**Modo visualización (por defecto):**
- Muestra el stock para **todos** los productos (ya no hay texto "Sin control").
- Para `track_stock = true`: mantiene los colores de alerta (rojo crítico, ámbar bajo) y el indicador de mínimo.
- Para `track_stock = false`: muestra el número en gris (`text-[#94a3b8]`), sin indicadores de alerta.
- El número tiene `cursor-pointer` y un tooltip "Clic para editar stock".

**Modo edición (al hacer clic en el número):**
- Reemplaza el número por un `<input type="number">` con el valor actual pre-relleno.
- Ancho fijo, texto negro, borde azul.
- Enter → guarda (llama `editarStock`), vuelve a modo visualización y llama `onRefresh()`.
- Escape → cancela sin guardar.
- Blur → cancela sin guardar (el usuario puede hacer clic fuera para cancelar).
- Durante el guardado: input deshabilitado + spinner de loading state mínimo.

Estado local en `ProductRow`:
```typescript
const [editingStock, setEditingStock] = useState(false)
const [stockDraft, setStockDraft] = useState('')
const [stockPending, setStockPending] = useState(false)
```

---

## Parte 2: Descuento de stock en comandas (tpv.ts)

### `addOrderItem` — descuento al añadir

Tras el insert exitoso de `order_items`, si el producto tiene `track_stock = true`:

```typescript
// Fetch track_stock alongside existing product fetch
const { data: product } = await supabase
  .from('products')
  .select('name, price, tax_rate, track_stock, stock')
  .eq('id', productId)
  .single()

// After item insert, deduct stock
if (product.track_stock) {
  const newStock = (Number(product.stock) || 0) - quantity
  await supabase.from('products')
    .update({ stock: newStock })
    .eq('id', productId)
    .eq('restaurant_id', restaurantId)

  await supabase.from('stock_movements').insert({
    restaurant_id: restaurantId,
    product_id: productId,
    type: 'venta',
    quantity,
    cost_price: null,
    purchase_date: null,
    notes: null,
    created_by: user.id,
  })
}
```

Nota: el stock puede quedar negativo — no se bloquea el añadido si no hay stock suficiente. El sistema solo registra el movimiento.

### `removeOrderItem` — restauración al eliminar ítem

Antes de marcar como `cancelled`, leer `product_id` y `quantity` del ítem. Si el producto tiene `track_stock = true`, restaurar el stock:

```typescript
const { data: item } = await supabase
  .from('order_items')
  .select('product_id, quantity')
  .eq('id', itemId)
  .eq('restaurant_id', restaurantId)
  .single()

// Mark as cancelled (existing logic)
// ...

// Restore stock
if (item) {
  const { data: prod } = await supabase
    .from('products')
    .select('track_stock, stock')
    .eq('id', item.product_id)
    .single()

  if (prod?.track_stock) {
    await supabase.from('products')
      .update({ stock: (Number(prod.stock) || 0) + item.quantity })
      .eq('id', item.product_id)
      .eq('restaurant_id', restaurantId)

    await supabase.from('stock_movements').insert({
      restaurant_id: restaurantId,
      product_id: item.product_id,
      type: 'ajuste',
      quantity: item.quantity,
      cost_price: null,
      purchase_date: null,
      notes: 'Anulación de línea',
      created_by: user.id,
    })
  }
}
```

### `updateOrderItemQuantity` — ajuste de cantidad

La función actualmente lee solo `unit_price`. Necesita también leer `product_id` y `quantity` (la cantidad actual antes del cambio).

Si `quantity <= 0` ya llama a `removeOrderItem` — eso restaurará el stock completo del ítem, correcto.

Si `quantity > 0`:
- `delta = newQuantity - oldQuantity`
- Si `delta != 0` y producto tiene `track_stock = true`:
  - `newStock = currentStock - delta` (si aumenta cantidad, resta; si reduce, suma)
  - Actualizar `products.stock`
  - Insertar `stock_movements` con `type: delta > 0 ? 'venta' : 'ajuste'`, `quantity: Math.abs(delta)`

### `cancelOrder` — restauración al cancelar comanda completa

Antes de marcar ítems como cancelados, leer todos los ítems no cancelados con `product_id` y `quantity`. Para cada uno cuyo producto tenga `track_stock = true`, restaurar stock en batch:

```typescript
// Fetch all active items
const { data: activeItems } = await supabase
  .from('order_items')
  .select('product_id, quantity')
  .eq('order_id', orderId)
  .eq('restaurant_id', restaurantId)
  .neq('status', 'cancelled')

// Bulk cancel (existing logic)
// ...

// Restore stock for track_stock products
for (const item of activeItems ?? []) {
  const { data: prod } = await supabase
    .from('products')
    .select('track_stock, stock')
    .eq('id', item.product_id)
    .single()

  if (prod?.track_stock) {
    await supabase.from('products')
      .update({ stock: (Number(prod.stock) || 0) + item.quantity })
      .eq('id', item.product_id)
      .eq('restaurant_id', restaurantId)

    await supabase.from('stock_movements').insert({
      restaurant_id: restaurantId,
      product_id: item.product_id,
      type: 'ajuste',
      quantity: item.quantity,
      cost_price: null,
      purchase_date: null,
      notes: 'Cancelación de comanda',
      created_by: user.id,
    })
  }
}
```

---

## Ficheros afectados

| Fichero | Cambio |
|---------|--------|
| `app/actions/productos.ts` | Añadir `editarStock` |
| `app/actions/tpv.ts` | Modificar `addOrderItem`, `removeOrderItem`, `updateOrderItemQuantity`, `cancelOrder` |
| `components/productos/ProductRow.tsx` | Celda de stock inline-editable, mostrar stock para todos |

---

## Lo que NO cambia

- `lib/supabase/server.ts`, auth, resto de componentes.
- El stock en negativo está permitido — no se bloquea el añadido si no hay existencias.
- La sección "Historial" del ProductRow ya muestra `stock_movements` con type='venta', así que los nuevos movimientos aparecerán automáticamente ahí.
