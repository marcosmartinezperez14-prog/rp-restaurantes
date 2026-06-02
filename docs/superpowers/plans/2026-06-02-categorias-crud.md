# Categorías CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir, editar y eliminar categorías desde la página de Productos mediante un panel lateral con CRUD inline.

**Architecture:** Tres server actions nuevas en `productos.ts` (create/update/delete). Nuevo `CategoriasPanel` Client Component con lista editable inline. `ProductsClient` pasa `categories` a estado local para poder refrescarlo tras mutaciones sin recargar la página.

**Tech Stack:** Next.js 16.2.6 · React 19 · TypeScript 5 strict · Tailwind v4 · @supabase/ssr v0.10.3

> **Verificación por tarea:** `npx tsc --noEmit`. Verificación final: `npm run build`.

---

## File Map

| Fichero | Estado | Responsabilidad |
|---------|--------|----------------|
| `app/actions/productos.ts` | Modificar | Añadir `createCategoria`, `updateCategoria`, `deleteCategoria` |
| `components/productos/CategoriasPanel.tsx` | Crear | Panel lateral CRUD de categorías |
| `app/productos/ProductsClient.tsx` | Modificar | Estado local de categories, botón Categorías, render del panel |
| `app/productos/page.tsx` | Modificar | Renombrar prop `categories` → `initialCategories` |

---

## Task 1: Server actions de categorías

**Files:**
- Modify: `app/actions/productos.ts`

- [ ] **Step 1: Añadir `createCategoria` al final del fichero**

Abre `app/actions/productos.ts` y añade al final:

```typescript
export async function createCategoria(
  name: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!name.trim()) return { error: 'El nombre es obligatorio' }

  const { data: maxPosRow } = await supabase
    .from('categories')
    .select('position')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxPosRow?.position ?? -1) + 1

  const { error } = await supabase
    .from('categories')
    .insert({ restaurant_id: restaurantId, name: name.trim(), position })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateCategoria(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!name.trim()) return { error: 'El nombre es obligatorio' }

  const { error } = await supabase
    .from('categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}

export async function deleteCategoria(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)

  if (count && count > 0) {
    return {
      error: `Esta categoría tiene ${count} producto${count !== 1 ? 's' : ''} asignado${count !== 1 ? 's' : ''}. Reasígnalos antes de eliminarla.`,
    }
  }

  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add app/actions/productos.ts
git commit -m "feat: add createCategoria, updateCategoria, deleteCategoria server actions"
```

---

## Task 2: Crear `CategoriasPanel`

**Files:**
- Create: `components/productos/CategoriasPanel.tsx`

- [ ] **Step 1: Crear `components/productos/CategoriasPanel.tsx`**

```tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import type { Categoria } from '@/app/actions/productos'
import { createCategoria, updateCategoria, deleteCategoria } from '@/app/actions/productos'

interface Props {
  categories: Categoria[]
  onClose: () => void
  onChanged: () => void
}

export default function CategoriasPanel({ categories, onClose, onChanged }: Props) {
  const [localCategories, setLocalCategories] = useState(categories)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [newError, setNewError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  function handleCreate() {
    if (!newName.trim()) { setNewError('El nombre es obligatorio'); return }
    setNewError(null)
    startTransition(async () => {
      const res = await createCategoria(newName.trim())
      if ('error' in res) { setNewError(res.error); return }
      setNewName('')
      onChanged()
    })
  }

  function startEdit(cat: Categoria) {
    setEditingId(cat.id)
    setEditingName(cat.name)
    setRowError(prev => { const next = { ...prev }; delete next[cat.id]; return next })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName('')
  }

  function handleUpdate(id: string) {
    if (!editingName.trim()) {
      setRowError(prev => ({ ...prev, [id]: 'El nombre es obligatorio' }))
      return
    }
    startTransition(async () => {
      const res = await updateCategoria(id, editingName.trim())
      if (res.error) { setRowError(prev => ({ ...prev, [id]: res.error! })); return }
      setEditingId(null)
      onChanged()
    })
  }

  function handleDelete(id: string) {
    setRowError(prev => { const next = { ...prev }; delete next[id]; return next })
    startTransition(async () => {
      const res = await deleteCategoria(id)
      if (res.error) { setRowError(prev => ({ ...prev, [id]: res.error! })); return }
      onChanged()
    })
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[440px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
          <h2 className="text-[15px] font-bold text-[#0f172a]">Categorías</h2>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#0f172a] text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Nueva categoría */}
          <div>
            <p className="text-xs font-medium text-[#64748b] mb-1.5">Nueva categoría</p>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Nombre de la categoría"
                className="flex-1 border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400"
              />
              <button
                onClick={handleCreate}
                disabled={isPending}
                className="px-3 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                Añadir
              </button>
            </div>
            {newError && <p className="text-red-600 text-xs mt-1">{newError}</p>}
          </div>

          {/* Lista */}
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-[#64748b] mb-1">
              {localCategories.length} categoría{localCategories.length !== 1 ? 's' : ''}
            </p>
            {localCategories.length === 0 && (
              <p className="text-sm text-[#94a3b8] py-4 text-center">Sin categorías</p>
            )}
            {localCategories.map(cat => (
              <div key={cat.id} className="flex flex-col">
                {editingId === cat.id ? (
                  <div className="flex gap-2 py-1.5">
                    <input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleUpdate(cat.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                      className="flex-1 border border-blue-400 rounded-lg px-3 py-1.5 text-sm text-[#0f172a] outline-none"
                    />
                    <button
                      onClick={() => handleUpdate(cat.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-2 px-1 rounded-lg group hover:bg-slate-50">
                    <span className="flex-1 text-sm text-[#0f172a]">{cat.name}</span>
                    <button
                      onClick={() => startEdit(cat)}
                      className="px-2.5 py-1 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={isPending}
                      className="px-2.5 py-1 text-xs border border-red-100 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
                {rowError[cat.id] && (
                  <p className="text-red-600 text-xs pb-1 pl-1">{rowError[cat.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add components/productos/CategoriasPanel.tsx
git commit -m "feat: add CategoriasPanel slide-over component"
```

---

## Task 3: Actualizar `ProductsClient` y `page.tsx`

**Files:**
- Modify: `app/productos/ProductsClient.tsx`
- Modify: `app/productos/page.tsx`

- [ ] **Step 1: Reemplazar `app/productos/ProductsClient.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
import { getProductos, getCategorias } from '@/app/actions/productos'
import ProductRow from '@/components/productos/ProductRow'
import AddProductPanel from '@/components/productos/AddProductPanel'
import CategoriasPanel from '@/components/productos/CategoriasPanel'

interface Props {
  initialProducts: ProductoConCategoria[]
  initialCategories: Categoria[]
}

export default function ProductsClient({ initialProducts, initialCategories }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [categories, setCategories] = useState(initialCategories)
  const [search, setSearch] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showCategorias, setShowCategorias] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getProductos()
      setProducts(fresh)
    })
  }

  function refreshCategories() {
    startTransition(async () => {
      const fresh = await getCategorias()
      setCategories(fresh)
    })
  }

  function handleCategoriaChanged() {
    refreshCategories()
    handleRefresh()
  }

  const visible = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      || p.category_name.toLowerCase().includes(search.toLowerCase())
    const matchLow = !filterLow || (p.track_stock && p.stock !== null && p.stock_min !== null && p.stock <= p.stock_min)
    return matchSearch && matchLow
  })

  const lowStockCount = products.filter(p =>
    p.track_stock && p.stock !== null && p.stock_min !== null && p.stock <= p.stock_min
  ).length

  return (
    <div>
      {/* Barra de filtros */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto o categoría..."
          className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 w-64"
        />
        {lowStockCount > 0 && (
          <button
            onClick={() => setFilterLow(f => !f)}
            className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
              filterLow
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            Stock bajo ({lowStockCount})
          </button>
        )}
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="px-3 py-2 text-sm bg-slate-100 border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-200 disabled:opacity-50"
        >
          {isPending ? 'Actualizando...' : 'Actualizar'}
        </button>
        <button
          onClick={() => setShowCategorias(true)}
          className="px-4 py-2 text-sm border border-[#e2e8f0] bg-white rounded-lg text-[#64748b] hover:bg-slate-50 font-medium"
        >
          Categorías
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span> Añadir producto
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Categoría</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">P. Venta</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">P. Coste</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">Margen</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">Stock</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Proveedor</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(product => (
              <ProductRow key={product.id} product={product} onRefresh={handleRefresh} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#94a3b8]">
                  {search || filterLow ? 'Sin resultados para el filtro aplicado' : 'Sin productos'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Panel añadir producto */}
      {showAdd && (
        <AddProductPanel
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSaved={handleRefresh}
        />
      )}

      {/* Panel categorías */}
      {showCategorias && (
        <CategoriasPanel
          categories={categories}
          onClose={() => setShowCategorias(false)}
          onChanged={handleCategoriaChanged}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Actualizar `app/productos/page.tsx`**

Cambiar solo la línea del `<ProductsClient`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos, getCategorias } from '@/app/actions/productos'
import AppShell from '@/components/AppShell'
import ProductsClient from './ProductsClient'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [products, categories] = await Promise.all([
    getProductos(),
    getCategorias(),
  ])

  return (
    <AppShell title="Productos e Inventario">
      <ProductsClient initialProducts={products} initialCategories={categories} />
    </AppShell>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add app/productos/ProductsClient.tsx app/productos/page.tsx
git commit -m "feat: add Categorias button and panel to ProductsClient"
```

---

## Task 4: Build final y push

- [ ] **Step 1: Build de producción**

```powershell
npm run build
```

Resultado esperado:
```
✓ Compiled successfully
...
├ ƒ /productos
...
```

- [ ] **Step 2: Push**

```powershell
git push
```

---

## Self-Review

### Cobertura del spec

| Requisito | Tarea |
|-----------|-------|
| Botón "Categorías" en barra de Productos | Task 3 |
| Panel lateral igual al de AddProductPanel | Task 2 |
| Lista todas las categorías | Task 2 |
| Crear categoría con nombre | Task 1 + Task 2 |
| Editar nombre inline | Task 1 + Task 2 |
| Eliminar bloqueado si tiene productos | Task 1 (`deleteCategoria`) |
| Error con número de productos bloqueantes | Task 1 (mensaje dinámico con count) |
| Soft-delete si no tiene productos | Task 1 |
| `onChanged` refresca categorías y productos | Task 3 (`handleCategoriaChanged`) |
| `useEffect` sincroniza `localCategories` con prop | Task 2 |
| Validación nombre vacío (create y update) | Task 1 (server) + Task 2 (client) |
| `categories` como estado local en `ProductsClient` | Task 3 |
| Prop renombrada a `initialCategories` en page.tsx | Task 3 |
| TypeScript sin `any` | ✓ todos los tipos explícitos |
| Misma estética que el resto | ✓ mismas clases Tailwind |
| Todo en español | ✓ |
