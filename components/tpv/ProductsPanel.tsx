'use client'

import { useState } from 'react'
import type { Category, ProductWithModifiers } from '@/app/actions/tpv'
import type { ItemConModificadores } from '@/types/modificadores'
import SelectorModificadores from '@/components/shared/SelectorModificadores'

interface Props {
  categories: Category[]
  products: ProductWithModifiers[]
  onAddProduct: (resultado: ItemConModificadores) => void
  disabled: boolean
}

export default function ProductsPanel({ categories, products, onAddProduct, disabled }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectorItem, setSelectorItem] = useState<{ id: string; name: string; price: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category_id === activeCategory
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function handleProductClick(product: ProductWithModifiers) {
    if (!product.is_available) { showToast(`${product.name} no está disponible`); return }
    if (disabled) return

    if (product.modifierGroups.length > 0) {
      setSelectorItem({ id: product.id, name: product.name, price: product.price })
    } else {
      onAddProduct({ menu_item_id: product.id, cantidad: 1, precio_final: product.price, modifiers_snapshot: [] })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg outline-none focus:border-[#2563eb]"
          style={{ color: 'black' }}
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-[var(--border)] flex-shrink-0">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
            activeCategory === 'all'
              ? 'bg-[#2563eb] text-white'
              : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#2563eb]'
          }`}
        >
          Todas
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              activeCategory === cat.id
                ? 'bg-[#2563eb] text-white'
                : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#2563eb]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
        {filtered.map(product => (
          <button
            key={product.id}
            onClick={() => handleProductClick(product)}
            disabled={disabled || !product.is_available}
            className={`text-left p-3 rounded-xl border transition-colors ${
              !product.is_available
                ? 'border-[var(--border)] bg-[var(--bg-page)] opacity-50 cursor-not-allowed'
                : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#2563eb] hover:bg-blue-50'
            }`}
          >
            <p className="font-semibold text-sm text-[var(--text-primary)] leading-tight">{product.name}</p>
            <p className="text-sm text-[#2563eb] font-bold mt-1">{Number(product.price).toFixed(2)} €</p>
            {product.modifierGroups.length > 0 && (
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Personalizable</p>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-2 text-center text-[var(--text-secondary)] text-sm py-8">Sin productos</p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-10">
          {toast}
        </div>
      )}

      {/* Selector de modificadores */}
      {selectorItem && (
        <SelectorModificadores
          menuItem={selectorItem}
          onConfirmar={resultado => { onAddProduct(resultado); setSelectorItem(null) }}
          onCancelar={() => setSelectorItem(null)}
        />
      )}
    </div>
  )
}
