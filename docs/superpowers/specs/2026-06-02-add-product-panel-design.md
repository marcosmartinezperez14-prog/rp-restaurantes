# Añadir Producto — Panel Lateral (Slide-over)

**Fecha:** 2026-06-02
**Scope:** Botón + panel lateral para crear nuevos productos desde la sección de Productos.

---

## Objetivo

Permitir al usuario crear un producto nuevo desde la página de Productos sin salir de ella. Un botón prominente abre un panel lateral con formulario completo. Al guardar, la lista se refresca sin recargar la página.

---

## Arquitectura

### Ficheros afectados

| Fichero | Tipo | Cambio |
|---------|------|--------|
| `app/actions/productos.ts` | Server | Añadir `getCategorias` y `createProduct` |
| `app/productos/page.tsx` | Server Component | Cargar categorías y pasarlas como prop |
| `app/productos/ProductsClient.tsx` | Client Component | Botón + integrar `AddProductPanel` |
| `components/productos/AddProductPanel.tsx` | Client Component | **Nuevo** — slide-over con formulario |

### Flujo de datos

```
ProductosPage (SC)
  ├── getProductos()         → initialProducts
  ├── getCategorias()        → categories
  └── <ProductsClient initialProducts categories />
        └── <AddProductPanel categories onClose onSaved />
              └── createProduct(params) → { success } | { error }
                    └── onSaved() → handleRefresh() → getProductos()
```

---

## Server Actions

### `getCategorias(): Promise<Categoria[]>`

```typescript
export type Categoria = { id: string; name: string; position: number }
```

- Filtra por `restaurant_id` del usuario en sesión.
- Ordena por `position ASC, name ASC`.
- Devuelve array vacío si no hay categorías.

### `createProduct(params): Promise<{ success: true } | { error: string }>`

Parámetros:

```typescript
{
  name: string           // obligatorio
  categoryId: string     // obligatorio, FK → categories
  description?: string
  price: number          // > 0
  costPrice?: number     // > 0 si se proporciona
  taxRate: number        // 4 | 10 | 21
  stock: number          // default 0
  stockMin: number       // default 0
  trackStock: boolean
  supplier?: string
  sku?: string
  isAvailable: boolean   // default true
  isVisible: boolean     // default true
}
```

Lógica:
1. Obtener `restaurant_id` del usuario en sesión (misma helper que el resto de actions).
2. Calcular `position`: `SELECT MAX(position) FROM products WHERE restaurant_id = ? AND category_id = ?` → `MAX + 1`, o `0` si no hay productos en esa categoría.
3. Insertar en `products` con todos los campos. `last_purchase_date` queda `null`.
4. Si `trackStock === true && stock > 0`: insertar en `stock_movements` con `type='ajuste'`, `quantity=stock`, `notes='Stock inicial'`, `cost_price=null`, `purchase_date=null`, `created_by=user.id`.
5. Devolver `{ success: true }` o `{ error: mensaje_en_español }`.

---

## Componente `AddProductPanel`

### Props

```typescript
interface Props {
  categories: Categoria[]
  onClose: () => void
  onSaved: () => void
}
```

### Layout

- **Overlay:** `fixed inset-0 bg-black/40 z-40` — clic fuera cierra el panel.
- **Panel:** `fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col` — desliza desde la derecha.
- **Cabecera fija:** título "Nuevo producto" + botón ✕.
- **Cuerpo scrollable:** `flex-1 overflow-y-auto px-5 py-4` con todos los campos.
- **Footer fijo:** botones Cancelar (borde) y Guardar (azul, `disabled` durante pending).

### Campos del formulario

| Campo | Tipo | Validación |
|-------|------|-----------|
| Nombre | `input text` | Obligatorio |
| Categoría | `select` | Obligatorio |
| Descripción | `textarea` (2 filas) | Opcional |
| Precio de venta (€) | `input number` | Obligatorio, > 0 |
| Precio de compra (€) | `input number` | Opcional, > 0 si se rellena |
| IVA aplicable | `select` 4% / 10% / 21% | Obligatorio (default 10%) |
| Stock actual | `input number` min 0 | Default 0 |
| Stock mínimo | `input number` min 0 | Default 0 |
| Controlar stock | `checkbox` | — |
| Proveedor | `input text` | Opcional |
| SKU / código interno | `input text` | Opcional |
| Disponible | `checkbox` | Default `true` |
| Visible en carta | `checkbox` | Default `true` |

Layout de columnas:
- Fila 1: Nombre (ancho completo)
- Fila 2: Categoría (ancho completo)
- Fila 3: Descripción (ancho completo)
- Fila 4: Precio de venta | Precio de compra
- Fila 5: IVA (ancho completo)
- Fila 6: Stock actual | Stock mínimo
- Fila 7: Controlar stock (checkbox inline)
- Fila 8: Proveedor | SKU
- Fila 9: Disponible | Visible en carta (checkboxes inline)

### Validación cliente

Antes de llamar a la server action:
1. `name.trim()` no vacío → "El nombre es obligatorio"
2. `categoryId` seleccionado → "Selecciona una categoría"
3. `price > 0` → "El precio de venta debe ser mayor que 0"
4. Si `costPrice` relleno → `costPrice > 0` → "El precio de compra debe ser mayor que 0"

Los errores se muestran bajo el footer del panel en rojo.

### Cierre y limpieza

- Botón ✕, botón Cancelar, y clic en el overlay cierran el panel.
- Al cerrar, el estado local del formulario se descarta (el componente se desmonta).

### Éxito

1. Panel llama `onSaved()` → `handleRefresh()` en `ProductsClient` recarga la lista.
2. Panel llama `onClose()` → se desmonta.
3. No hay toast adicional — el nuevo producto aparece en la tabla como confirmación visual.

---

## Integración en `ProductsClient`

- Añadir estado `const [showAdd, setShowAdd] = useState(false)`.
- Botón en la barra de filtros, a la derecha del todo: `+ Añadir producto` (azul, `bg-blue-600 text-white`).
- Renderizar `{showAdd && <AddProductPanel ... />}` al final del JSX (fuera de la tabla).
- `onSaved` reutiliza `handleRefresh` ya existente.

---

## Integración en `ProductosPage`

```tsx
const [products, categories] = await Promise.all([
  getProductos(),
  getCategorias(),
])
```

Pasar `categories` como nueva prop a `ProductsClient`.

---

## Lo que NO cambia

- `lib/supabase/server.ts` — sin modificar.
- Archivos de auth — sin modificar.
- `ProductRow`, `EditProductModal`, demás modales — sin modificar.
- El resto de server actions existentes — sin modificar.
