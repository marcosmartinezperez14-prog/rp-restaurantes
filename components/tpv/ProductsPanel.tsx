'use client'

import { useState } from 'react'
import type { Category, ProductWithModifiers, SelectedModifier } from '@/app/actions/tpv'
import ModifierModal from './ModifierModal'

interface Props {
  categories: Category[]
  products: ProductWithModifiers[]
  onAddProduct: (productId: string, modifiers: SelectedModifier[], quantity: number) => void
  disabled: boolean
}

export default function ProductsPanel({ categories, products, onAddProduct, disabled }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [modalProduct, setModalProduct] = useState<ProductWithModifiers | null>(null)
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
    if (!product.is_available) {
      showToast(`${product.name} no está disponible`)
    }
    if (product.modifierGroups.length > 0) {
      setModalProduct(product)
    } else {
      onAddProduct(product.id, [], 1)
    }
  }

  function handleModalConfirm(modifiers: SelectedModifier[]) {
    if (!modalProduct) return
    onAddProduct(modalProduct.id, modifiers, 1)
    setModalProduct(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-[#e2e8f0] flex-shrink-0">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg outline-none focus:border-[#2563eb]"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-[#e2e8f0] flex-shrink-0">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
            activeCategory === 'all'
              ? 'bg-[#2563eb] text-white'
              : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:border-[#2563eb]'
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
                : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:border-[#2563eb]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map(product => (
            <button
              key={product.id}
              onClick={() => handleProductClick(product)}
              disabled={disabled}
              style={{ opacity: product.is_available ? 1 : 0.4 }}
              className="bg-white border border-[#e2e8f0] rounded-xl p-3 text-left hover:shadow-md transition-shadow disabled:cursor-not-allowed relative"
            >
              {!product.is_available && (
                <span className="absolute top-2 right-2 text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded uppercase font-semibold">
                  No disponible
                </span>
              )}
              <div className="font-medium text-sm text-[#0f172a] leading-tight mb-1 pr-2">
                {product.name}
              </div>
              <div className="text-[#2563eb] font-bold text-sm">
                {Number(product.price).toFixed(2)} €
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-[#94a3b8] text-sm py-8">Sin productos</p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 pointer-events-none">
          {toast}
        </div>
      )}

      {/* Modifier modal */}
      {modalProduct && (
        <ModifierModal
          product={modalProduct}
          onConfirm={handleModalConfirm}
          onClose={() => setModalProduct(null)}
        />
      )}
    </div>
  )
}
