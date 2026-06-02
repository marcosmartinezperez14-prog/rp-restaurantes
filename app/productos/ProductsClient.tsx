'use client'

import { useState, useTransition } from 'react'
import type { ProductoConCategoria, Categoria } from '@/app/actions/productos'
import { getProductos } from '@/app/actions/productos'
import ProductRow from '@/components/productos/ProductRow'
import AddProductPanel from '@/components/productos/AddProductPanel'

interface Props {
  initialProducts: ProductoConCategoria[]
  categories: Categoria[]
}

export default function ProductsClient({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getProductos()
      setProducts(fresh)
    })
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

      {/* Panel lateral */}
      {showAdd && (
        <AddProductPanel
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSaved={handleRefresh}
        />
      )}
    </div>
  )
}
