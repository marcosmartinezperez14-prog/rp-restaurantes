'use client'

import { useState, useTransition } from 'react'
import { saveMenuData, type CategoryInput } from '@/app/actions/onboarding'

interface Props {
  categories: CategoryInput[]
  onNext: (categories: CategoryInput[]) => void
}

export default function Step3Menu({ categories: initialCategories, onNext }: Props) {
  const [categories, setCategories] = useState<CategoryInput[]>(initialCategories)
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const addCategory = () => {
    setCategories(c => [...c, { name: 'Nueva categoría', products: [] }])
  }

  const removeCategory = (idx: number) => {
    setCategories(c => c.filter((_, i) => i !== idx))
  }

  const updateCategoryName = (idx: number, name: string) => {
    setCategories(c => c.map((cat, i) => (i === idx ? { ...cat, name } : cat)))
  }

  const addProduct = (catIdx: number) => {
    setCategories(c =>
      c.map((cat, i) => {
        if (i !== catIdx) return cat
        return { ...cat, products: [...cat.products, { name: 'Nuevo producto', price: 0 }] }
      })
    )
  }

  const removeProduct = (catIdx: number, prodIdx: number) => {
    setCategories(c =>
      c.map((cat, i) => {
        if (i !== catIdx) return cat
        return { ...cat, products: cat.products.filter((_, pi) => pi !== prodIdx) }
      })
    )
  }

  const updateProduct = (
    catIdx: number,
    prodIdx: number,
    field: 'name' | 'price',
    value: string
  ) => {
    setCategories(c =>
      c.map((cat, i) => {
        if (i !== catIdx) return cat
        return {
          ...cat,
          products: cat.products.map((p, pi) => {
            if (pi !== prodIdx) return p
            return field === 'price'
              ? { ...p, price: parseFloat(value) || 0 }
              : { ...p, name: value }
          }),
        }
      })
    )
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveMenuData(categories)
      if (result?.error) {
        setError(result.error)
      } else {
        onNext(categories)
      }
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Tu carta</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Revisa y personaliza las categorías y productos de tu carta.
      </p>

      {categories.map((cat, catIdx) => (
        <div key={catIdx} className="border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            {editingCatIdx === catIdx ? (
              <input
                autoFocus
                value={cat.name}
                onChange={e => updateCategoryName(catIdx, e.target.value)}
                onBlur={() => setEditingCatIdx(null)}
                className="flex-1 border border-blue-400 rounded px-2 py-1 text-[var(--text-primary)] text-sm focus:outline-none"
              />
            ) : (
              <span className="font-medium text-[var(--text-primary)] flex-1">{cat.name}</span>
            )}
            <button
              type="button"
              onClick={() => setEditingCatIdx(catIdx)}
              className="text-[var(--text-secondary)] hover:text-blue-600 px-2 text-sm"
              title="Renombrar categoría"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => removeCategory(catIdx)}
              className="text-[var(--text-secondary)] hover:text-red-500 px-2 text-sm"
              title="Eliminar categoría"
            >
              🗑
            </button>
          </div>

          <div className="space-y-2">
            {cat.products.map((prod, prodIdx) => (
              <div key={prodIdx} className="flex items-center gap-2">
                <input
                  value={prod.name}
                  onChange={e => updateProduct(catIdx, prodIdx, 'name', e.target.value)}
                  placeholder="Nombre del producto"
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-[var(--text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <div className="flex items-center border border-gray-300 rounded px-2 py-1 w-24">
                  <input
                    type="number"
                    value={prod.price}
                    onChange={e => updateProduct(catIdx, prodIdx, 'price', e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full text-[var(--text-primary)] text-sm focus:outline-none"
                  />
                  <span className="text-[var(--text-secondary)] text-sm ml-1">€</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeProduct(catIdx, prodIdx)}
                  className="text-[var(--text-secondary)] hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addProduct(catIdx)}
              className="text-blue-600 hover:underline text-sm"
            >
              + Añadir producto
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addCategory}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-[var(--text-secondary)] hover:border-blue-400 hover:text-blue-600 text-sm transition-colors"
      >
        + Añadir categoría
      </button>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Guardando...' : 'Guardar y continuar →'}
      </button>
    </div>
  )
}
