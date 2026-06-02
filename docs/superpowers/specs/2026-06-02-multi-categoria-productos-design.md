# Productos Multi-Categoría — Design Spec

**Fecha:** 2026-06-02
**Scope:** Permitir que un producto pertenezca a múltiples categorías mediante una tabla de relación `product_categories`.

---

## Estado de la migración

La migración SQL **ya ha sido ejecutada** en Supabase:

```sql
CREATE TABLE product_categories (
  product_id  UUID NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  restaurant_id UUID NOT NULL,
  PRIMARY KEY (product_id, category_id)
);

INSERT INTO product_categories (product_id, category_id, restaurant_id)
SELECT id, category_id, restaurant_id
FROM products
WHERE category_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE products DROP COLUMN category_id;
```

La columna `category_id` ya no existe en `products`. Todos los productos existentes tienen sus categorías migradas a `product_categories`.

---

## Objetivo

Adaptar el código para usar la nueva relación many-to-many: un producto puede pertenecer a cero o más categorías, todas con el mismo peso (sin concepto de "categoría principal").

---

## Arquitectura

### Ficheros afectados

| Fichero | Tipo | Cambio |
|---------|------|--------|
| `app/actions/productos.ts` | Server | Actualizar tipo `ProductoConCategoria`, `getProductos`, `createProduct`, `updateProducto`, `deleteCategoria` |
| `components/productos/AddProductPanel.tsx` | Client | Selector único → checkboxes multi-select |
| `components/productos/EditProductModal.tsx` | Client | Añadir sección de categorías con checkboxes |
| `components/productos/ProductRow.tsx` | Client | Mostrar array de categorías en lugar de una sola |

---

## Cambios en `app/actions/productos.ts`

### Tipo `ProductoConCategoria`

Reemplazar:
```typescript
category_id: string
category_name: string
```
Por:
```typescript
categories: { id: string; name: string }[]
```

### `getProductos`

La query actual usa `.select('... category_id, categories(name)')`. Reemplazar por un join con `product_categories`:

```typescript
const { data } = await supabase
  .from('products')
  .select(`
    id, name, price, cost_price, tax_rate, is_available, is_visible,
    track_stock, stock, stock_min, supplier, last_purchase_date,
    product_categories(category_id, categories(id, name))
  `)
  .eq('restaurant_id', restaurantId)
  .is('deleted_at', null)
  .order('name')
```

El mapping extrae las categorías del join anidado:
```typescript
categories: (p.product_categories ?? []).map((pc: { category_id: string; categories: { id: string; name: string } | null }) => ({
  id: pc.category_id,
  name: pc.categories?.name ?? '—',
}))
```

### `createProduct`

- Parámetro `categoryId: string` → `categoryIds: string[]`
- Ya no inserta `category_id` en `products`
- Tras insertar el producto, inserta en `product_categories` una fila por cada `categoryId`
- Ya no calcula `position` por categoría — simplemente inserta con `position: 0` (la ordenación por categoría pierde sentido con multi-categoría)
- Si `categoryIds` está vacío, inserta el producto sin categorías

```typescript
// Insertar relaciones de categorías
if (params.categoryIds.length > 0) {
  const { error: catErr } = await supabase
    .from('product_categories')
    .insert(
      params.categoryIds.map(cid => ({
        product_id: product.id,
        category_id: cid,
        restaurant_id: restaurantId,
      }))
    )
  if (catErr) return { error: catErr.message }
}
```

### `updateProducto`

Añadir parámetro opcional `categoryIds?: string[]`. Si se proporciona:
1. Borrar todas las filas de `product_categories` donde `product_id = productId`
2. Insertar las nuevas filas

```typescript
if (params.categoryIds !== undefined) {
  await supabase
    .from('product_categories')
    .delete()
    .eq('product_id', productId)
    .eq('restaurant_id', restaurantId)

  if (params.categoryIds.length > 0) {
    await supabase.from('product_categories').insert(
      params.categoryIds.map(cid => ({
        product_id: productId,
        category_id: cid,
        restaurant_id: restaurantId,
      }))
    )
  }
}
```

### `deleteCategoria`

Reemplazar el count de `products.category_id` por count en `product_categories`:

```typescript
const { count } = await supabase
  .from('product_categories')
  .select('*', { count: 'exact', head: true })
  .eq('category_id', id)
  .eq('restaurant_id', restaurantId)
```

---

## Cambios en UI

### `AddProductPanel` — multi-select de categorías

Reemplazar el `<select>` único por una lista de checkboxes:

```tsx
{/* Categorías */}
<div className="flex flex-col gap-1">
  <span className="text-xs font-medium text-[#64748b]">Categorías</span>
  <div className="border border-[#e2e8f0] rounded-lg p-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
    {categories.map(c => (
      <label key={c.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-slate-50 rounded">
        <input
          type="checkbox"
          checked={selectedCategoryIds.includes(c.id)}
          onChange={e => {
            if (e.target.checked) setSelectedCategoryIds(prev => [...prev, c.id])
            else setSelectedCategoryIds(prev => prev.filter(id => id !== c.id))
          }}
          className="accent-blue-600 w-4 h-4"
        />
        <span className="text-sm text-[#0f172a]">{c.name}</span>
      </label>
    ))}
    {categories.length === 0 && (
      <p className="text-xs text-[#94a3b8] py-1 px-1">Sin categorías disponibles</p>
    )}
  </div>
</div>
```

Estado: `const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])`

Validación: no hay validación obligatoria (un producto puede no tener categoría).

Al llamar a `createProduct`, pasar `categoryIds: selectedCategoryIds`.

### `EditProductModal` — añadir sección de categorías

`EditProductModal` recibe el producto con `categories: { id: string; name: string }[]`. Necesita también las categorías disponibles del restaurante → añadir prop `allCategories: Categoria[]`.

Inicializar estado: `useState<string[]>(product.categories.map(c => c.id))`

Mismos checkboxes que en `AddProductPanel`. Al guardar, pasar `categoryIds` a `updateProducto`.

`ProductRow` pasa `allCategories` a `EditProductModal`. `ProductRow` recibe prop `allCategories: Categoria[]`. `ProductsClient` pasa `categories` (estado local) a `ProductRow` como `allCategories`.

### `ProductRow` — mostrar múltiples categorías

Reemplazar `product.category_name` por:

```tsx
<td className="px-4 py-3 text-xs text-[#64748b]">
  {product.categories.length > 0
    ? product.categories.map(c => c.name).join(', ')
    : <span className="text-[#94a3b8]">—</span>
  }
</td>
```

### `ProductsClient` — búsqueda adaptada

La búsqueda actual usa `p.category_name`. Reemplazar por:

```typescript
const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
  || p.categories.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
```

`ProductRow` recibe nueva prop `allCategories`. `ProductsClient` pasa `allCategories={categories}`.

---

## Interfaz de `ProductRow` actualizada

```typescript
interface Props {
  product: ProductoConCategoria
  allCategories: Categoria[]
  onRefresh: () => void
}
```

---

## Casos borde

| Caso | Comportamiento |
|------|---------------|
| Producto sin categorías | Columna categoría muestra "—" |
| Producto con 1 categoría | Muestra el nombre sin coma |
| Producto con N categorías | Nombres separados por ", " |
| Eliminar categoría con productos | Error vía count en `product_categories` |
| `categoryIds` vacío en createProduct | Producto se crea sin categorías |
| `categoryIds` vacío en updateProducto | Borra todas las categorías del producto |

---

## Lo que NO cambia

- `lib/supabase/server.ts` — sin modificar
- Archivos de auth — sin modificar
- `CategoriasPanel` — sin modificar (ya usa `getCategorias` que no toca `products`)
- `PurchaseModal`, `StockModal`, `StockHistory` — sin modificar
