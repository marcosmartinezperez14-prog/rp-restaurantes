'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ProductoConCategoria, Categoria, MenuItem } from '@/app/actions/productos'
import { getProductos, getCategorias } from '@/app/actions/productos'
import ProductRow from '@/components/productos/ProductRow'
import AddProductPanel from '@/components/productos/AddProductPanel'
import CategoriasPanel from '@/components/productos/CategoriasPanel'
import CartaClient from './CartaClient'

interface Props {
  initialProducts: ProductoConCategoria[]
  initialCategories: Categoria[]
  initialMenuItems: MenuItem[]
  canEdit?: boolean
}

export default function ProductsClient({ initialProducts, initialCategories, initialMenuItems, canEdit = false }: Props) {
  const [activeTab, setActiveTab] = useState<'productos' | 'carta'>('productos')
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
      || p.categories.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
    const matchLow = !filterLow || (p.track_stock && p.stock !== null && p.stock_min !== null && p.stock <= p.stock_min)
    return matchSearch && matchLow
  })

  const lowStockCount = products.filter(p =>
    p.track_stock && p.stock !== null && p.stock_min !== null && p.stock <= p.stock_min
  ).length

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab('productos')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'productos'
              ? 'border-blue-600 text-blue-700 bg-blue-50'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          📦 Productos
        </button>
        <button
          onClick={() => setActiveTab('carta')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'carta'
              ? 'border-blue-600 text-blue-700 bg-blue-50'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          🍽️ Carta
        </button>
      </div>

      {activeTab === 'productos' && (
        <>
          {/* Barra de filtros */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto o categoría..."
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 w-64"
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
              className="px-3 py-2 text-sm bg-[var(--bg-surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:opacity-80 disabled:opacity-50"
            >
              {isPending ? 'Actualizando...' : 'Actualizar'}
            </button>
            <Link
              href="/productos/movimientos"
              className="px-4 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] font-medium"
            >
              Movimientos
            </Link>
            {canEdit && (
              <button
                onClick={() => setShowCategorias(true)}
                className="px-4 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] font-medium"
              >
                Categorías
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setShowAdd(true)}
                className="ml-auto px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span> Añadir producto
              </button>
            )}
          </div>

          {/* Tabla */}
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-surface-hover)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Categoría</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">P. Coste</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Proveedor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    allCategories={categories}
                    onRefresh={handleRefresh}
                    canEdit={canEdit}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
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
        </>
      )}

      {activeTab === 'carta' && (
        <CartaClient
          initialMenuItems={initialMenuItems}
          categories={categories}
          allProducts={products}
          onProductsRefresh={handleRefresh}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
