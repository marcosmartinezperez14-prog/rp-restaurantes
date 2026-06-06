'use client'

import { useState, useTransition } from 'react'
import type { MenuItem, Categoria, ProductoConCategoria } from '@/app/actions/productos'
import { getMenuItems } from '@/app/actions/productos'
import MenuItemCard from '@/components/carta/MenuItemCard'
import MenuItemFormPanel from '@/components/carta/MenuItemFormPanel'

interface Props {
  initialMenuItems: MenuItem[]
  categories: Categoria[]
  allProducts: ProductoConCategoria[]
  onProductsRefresh: () => void
}

export default function CartaClient({ initialMenuItems, categories, allProducts }: Props) {
  const [menuItems, setMenuItems] = useState(initialMenuItems)
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [showPanel, setShowPanel] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getMenuItems()
      setMenuItems(fresh)
    })
  }

  function handleEdit(item: MenuItem) {
    setEditItem(item)
    setShowPanel(true)
  }

  function handleNewItem() {
    setEditItem(undefined)
    setShowPanel(true)
  }

  function handlePanelClose() {
    setShowPanel(false)
    setEditItem(undefined)
  }

  const visible = menuItems.filter(item =>
    !filterCategoryId || item.category_id === filterCategoryId
  )

  const usedCategoryIds = new Set(menuItems.map(m => m.category_id).filter(Boolean))
  const visibleCategories = categories.filter(c => usedCategoryIds.has(c.id))

  return (
    <div className={isPending ? 'opacity-70 pointer-events-none' : ''}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="px-3 py-2 text-sm bg-[var(--bg-surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:opacity-80 disabled:opacity-50"
        >
          {isPending ? 'Actualizando...' : 'Actualizar'}
        </button>

        {visibleCategories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterCategoryId('')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                !filterCategoryId
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              Todos
            </button>
            {visibleCategories.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCategoryId(c.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  filterCategoryId === c.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleNewItem}
          className="ml-auto px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          + Nuevo plato
        </button>
      </div>

      {menuItems.length > 0 && (
        <div className="flex gap-3 mb-4 text-sm text-[var(--text-secondary)]">
          <span>{menuItems.length} platos</span>
          <span>·</span>
          <span>{menuItems.filter(m => m.is_active).length} activos</span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-sm font-medium">
            {menuItems.length === 0 ? 'La carta está vacía' : 'Sin platos en esta categoría'}
          </p>
          {menuItems.length === 0 && (
            <button
              onClick={handleNewItem}
              className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              + Añadir primer plato
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {showPanel && (
        <MenuItemFormPanel
          item={editItem}
          categories={categories}
          allProducts={allProducts}
          onClose={handlePanelClose}
          onSaved={handleRefresh}
        />
      )}
    </div>
  )
}
