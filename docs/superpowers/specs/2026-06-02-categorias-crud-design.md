# Gestión de Categorías (CRUD) — Design Spec

**Fecha:** 2026-06-02
**Scope:** Añadir, editar y eliminar categorías desde la sección de Productos.

---

## Objetivo

Permitir al usuario gestionar las categorías de su restaurante sin salir de la página de Productos. Un botón "Categorías" abre un panel lateral con la lista completa, edición inline y creación de nuevas categorías. Las eliminaciones se bloquean si la categoría tiene productos asignados.

---

## Arquitectura

### Ficheros afectados

| Fichero | Tipo | Cambio |
|---------|------|--------|
| `app/actions/productos.ts` | Server | Añadir `createCategoria`, `updateCategoria`, `deleteCategoria` |
| `components/productos/CategoriasPanel.tsx` | Client Component | **Nuevo** — panel lateral con CRUD de categorías |
| `app/productos/ProductsClient.tsx` | Client Component | Añadir estado `showCategorias`, botón "Categorías", render del panel, refresh de categories |

### Flujo de datos

```
ProductsClient
  ├── [categories state] ← initialCategories prop (ya existe)
  └── <CategoriasPanel
        categories={categories}
        onClose={() => setShowCategorias(false)}
        onChanged={() => { refreshCategories(); handleRefresh() }}
      />
```

`onChanged` se llama en cada mutación (create, update, delete). Refresca tanto la lista de categorías del panel como la lista de productos (para que los `category_name` estén actualizados).

---

## Server Actions

### `createCategoria(name: string): Promise<{ success: true } | { error: string }>`

- Valida que `name.trim()` no esté vacío.
- Calcula `position = MAX(position) + 1` de las categorías del restaurante (o 0 si no hay ninguna).
- Inserta en `categories` con `restaurant_id`, `name`, `position`.
- Devuelve `{ success: true }` o `{ error: string }`.

### `updateCategoria(id: string, name: string): Promise<{ error?: string }>`

- Valida que `name.trim()` no esté vacío.
- Actualiza `name` en `categories` filtrando por `id` y `restaurant_id`.
- Devuelve `{}` o `{ error: string }`.

### `deleteCategoria(id: string): Promise<{ error?: string }>`

- Cuenta los productos activos de esa categoría: `SELECT COUNT(*) FROM products WHERE category_id = id AND restaurant_id = ? AND deleted_at IS NULL`.
- Si `count > 0`: devuelve `{ error: 'Esta categoría tiene X productos asignados. Reasígnalos antes de eliminarla.' }`.
- Si `count === 0`: hace soft-delete → `UPDATE categories SET deleted_at = now() WHERE id = ? AND restaurant_id = ?`.
- Devuelve `{}` o `{ error: string }`.

---

## Componente `CategoriasPanel`

### Props

```typescript
interface Props {
  categories: Categoria[]
  onClose: () => void
  onChanged: () => void
}
```

### Layout

Mismo patrón que `AddProductPanel`:
- **Overlay:** `fixed inset-0 bg-black/40 z-40`, clic fuera cierra.
- **Panel:** `fixed inset-y-0 right-0 w-full max-w-[440px] bg-white shadow-2xl z-50 flex flex-col`.
- **Cabecera fija:** título "Categorías" + botón ✕.
- **Cuerpo scrollable:** lista de categorías + formulario de nueva categoría arriba.
- **Sin footer** — las acciones son inline en cada fila.

### Estado interno

```typescript
const [localCategories, setLocalCategories] = useState(categories)
const [editingId, setEditingId] = useState<string | null>(null)
const [editingName, setEditingName] = useState('')
const [newName, setNewName] = useState('')
const [error, setError] = useState<string | null>(null)
const [isPending, startTransition] = useTransition()
```

### Sección "Nueva categoría"

- Input de texto con placeholder "Nombre de la categoría" + botón "Añadir".
- Al confirmar: llama `createCategoria(newName)`, si éxito → llama `onChanged()` y limpia el input.
- Si error → muestra bajo el input.

### Lista de categorías

Cada fila tiene dos modos:

**Modo normal:**
```
[nombre de la categoría]   [Editar] [Eliminar]
```

**Modo edición** (cuando `editingId === categoria.id`):
```
[input con el nombre]   [Guardar] [Cancelar]
```

- **Editar:** pone la fila en modo edición con el nombre actual pre-relleno.
- **Guardar:** llama `updateCategoria(id, editingName)`, si éxito → llama `onChanged()`, sale del modo edición.
- **Cancelar:** sale del modo edición sin guardar.
- **Eliminar:** llama `deleteCategoria(id)`:
  - Si `{ error }` → muestra el error en rojo bajo la fila.
  - Si éxito → llama `onChanged()`.
- No hay diálogo de confirmación para eliminar (el servidor bloquea si hay productos; si no los hay, es seguro eliminar directamente).

### Refresco de estado local

Tras cada `onChanged()`, el componente recibe `categories` actualizado como prop. Para evitar lag visual, el `CategoriasPanel` mantiene `localCategories` sincronizado con la prop `categories` via `useEffect`:

```typescript
useEffect(() => {
  setLocalCategories(categories)
}, [categories])
```

---

## Integración en `ProductsClient`

### Renombrar prop y añadir estado local

La prop `categories` de `ProductsClient` pasa a llamarse `initialCategories` (igual que `initialProducts`). Actualizar también `app/productos/page.tsx` para pasar `initialCategories={categories}`.

```typescript
// Props interface actualizada
interface Props {
  initialProducts: ProductoConCategoria[]
  initialCategories: Categoria[]
}

// Estados
const [categories, setCategories] = useState(initialCategories)
const [showCategorias, setShowCategorias] = useState(false)
```

### `refreshCategories`

```typescript
function refreshCategories() {
  startTransition(async () => {
    const fresh = await getCategorias()
    setCategories(fresh)
  })
}
```

### `onChanged` para el panel

```typescript
onChanged={() => {
  refreshCategories()
  handleRefresh()
}}
```

### Botón en barra de filtros

Justo antes del botón "Añadir producto":
```tsx
<button
  onClick={() => setShowCategorias(true)}
  className="px-4 py-2 text-sm border border-[#e2e8f0] bg-white rounded-lg text-[#64748b] hover:bg-slate-50 font-medium"
>
  Categorías
</button>
```

### Render del panel

```tsx
{showCategorias && (
  <CategoriasPanel
    categories={categories}
    onClose={() => setShowCategorias(false)}
    onChanged={() => { refreshCategories(); handleRefresh() }}
  />
)}
```

---

## Comportamiento en casos borde

| Caso | Comportamiento |
|------|---------------|
| Eliminar categoría con productos | Error: "Esta categoría tiene N productos asignados. Reasígnalos antes de eliminarla." |
| Crear categoría con nombre vacío | Validación cliente: no se llama a la action |
| Editar con nombre vacío | Validación cliente: no se llama a la action |
| Dos categorías con el mismo nombre | Se permite (el servidor no impone unicidad) |
| Editar mientras hay pending | Botones deshabilitados durante `isPending` |

---

## Lo que NO cambia

- `lib/supabase/server.ts` — sin modificar.
- Archivos de auth — sin modificar.
- `AddProductPanel`, modales de producto, `ProductRow` — sin modificar.
- `app/productos/page.tsx` — sin modificar (ya pasa `categories` correctamente).
