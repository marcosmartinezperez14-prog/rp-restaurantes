'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem, ProductoConCategoria, MenuCategoria } from '@/app/actions/productos'
import { createMenuItem, updateMenuItem, createMenuCategoria } from '@/app/actions/productos'
import GestorModificadores from './GestorModificadores'

const UNIT_OPTIONS = ['unit', 'kg', 'g', 'l', 'ml', 'dozen']

interface IngredientDraft {
  productId: string
  productName: string
  quantity: number
  unit: string
  costPrice: number
}

interface Props {
  item?: MenuItem
  menuCategories: MenuCategoria[]
  allProducts: ProductoConCategoria[]
  onClose: () => void
  onSaved: () => void
}

export default function MenuItemFormPanel({ item, menuCategories, allProducts, onClose, onSaved }: Props) {
  const isEditing = !!item

  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [categoryId, setCategoryId] = useState(item?.menu_category_id ?? '')
  const [price, setPrice] = useState(item?.price.toFixed(2) ?? '')
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '')
  const [isActive, setIsActive] = useState(item?.is_active ?? true)
  const [cantidadMinima, setCantidadMinima] = useState(item?.cantidad_minima ?? 1)
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    (item?.ingredients ?? []).map(ing => ({
      productId: ing.product_id,
      productName: ing.product?.name ?? ing.product_id,
      quantity: ing.quantity,
      unit: ing.unit,
      costPrice: ing.product?.cost_price ?? 0,
    }))
  )

  const [ingDropdownOpen, setIngDropdownOpen] = useState(false)
  const [ingSearch, setIngSearch] = useState('')
  const [ingQty, setIngQty] = useState('1')
  const [ingUnit, setIngUnit] = useState('unit')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProductName, setSelectedProductName] = useState('')
  const ingDropdownRef = useRef<HTMLDivElement>(null)

  const [localCategories, setLocalCategories] = useState<MenuCategoria[]>(menuCategories)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catPending, setCatPending] = useState(false)

  const [imageUploading, setImageUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const priceNum = parseFloat(price.replace(',', '.')) || 0

  const totalCost = useMemo(() =>
    ingredients.reduce((sum, ing) => sum + ing.costPrice * ing.quantity, 0),
    [ingredients]
  )

  const margin = priceNum > 0 ? ((priceNum - totalCost) / priceNum) * 100 : 0

  function marginTextClass(m: number): string {
    if (m < 30) return 'text-red-600 font-bold'
    if (m < 60) return 'text-amber-600 font-bold'
    return 'text-green-700 font-bold'
  }

  const filteredProducts = useMemo(() => {
    const available = allProducts.filter(p => !ingredients.find(i => i.productId === p.id))
    if (!ingSearch.trim()) return available
    const q = ingSearch.toLowerCase()
    return available.filter(p => p.name.toLowerCase().includes(q))
  }, [ingSearch, allProducts, ingredients])

  useEffect(() => {
    if (!ingDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (ingDropdownRef.current && !ingDropdownRef.current.contains(e.target as Node)) {
        setIngDropdownOpen(false)
        setIngSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ingDropdownOpen])

  function selectProduct(product: ProductoConCategoria) {
    setSelectedProductId(product.id)
    setSelectedProductName(product.name)
    setIngUnit(product.unit)
    setIngDropdownOpen(false)
    setIngSearch('')
  }

  async function handleCreateCategory() {
    if (!newCatName.trim()) return
    setCatPending(true)
    const res = await createMenuCategoria(newCatName.trim())
    setCatPending(false)
    if ('error' in res) { setError(res.error); return }
    const newCat: MenuCategoria = { id: res.id, name: res.name, position: localCategories.length }
    setLocalCategories(prev => [...prev, newCat])
    setCategoryId(res.id)
    setNewCatName('')
    setShowNewCat(false)
  }

  function addIngredient() {
    const qty = parseFloat(ingQty.replace(',', '.'))
    if (!selectedProductId) { setError('Selecciona un ingrediente'); return }
    if (isNaN(qty) || qty <= 0) { setError('La cantidad debe ser mayor que 0'); return }
    const product = allProducts.find(p => p.id === selectedProductId)
    if (!product) return

    setIngredients(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unit: ingUnit,
      costPrice: product.cost_price ?? 0,
    }])
    setSelectedProductId('')
    setSelectedProductName('')
    setIngQty('1')
    setIngUnit('unit')
    setError(null)
  }

  function removeIngredient(idx: number) {
    setIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleImageUpload(file: File) {
    setImageUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `menu-items/${Date.now()}.${ext}`
    const { data, error: uploadErr } = await supabase.storage
      .from('products')
      .upload(path, file, { upsert: true })
    if (uploadErr || !data) {
      setError('No se pudo subir la imagen')
      setImageUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('products').getPublicUrl(data.path)
    setImageUrl(urlData.publicUrl)
    setImageUploading(false)
  }

  function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (priceNum < 0) { setError('El precio no puede ser negativo'); return }

    setError(null)
    startTransition(async () => {
      const ingPayload = ingredients.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unit: i.unit,
      }))

      let res: { error?: string } | { success: true }
      if (isEditing) {
        res = await updateMenuItem(item.id, {
          name,
          description: description || null,
          menuCategoryId: categoryId || null,
          price: priceNum,
          imageUrl: imageUrl || null,
          isActive,
          ingredients: ingPayload,
          cantidadMinima,
        })
      } else {
        res = await createMenuItem({
          name,
          description: description || undefined,
          menuCategoryId: categoryId || undefined,
          price: priceNum,
          imageUrl: imageUrl || undefined,
          isActive,
          ingredients: ingPayload,
          cantidadMinima,
        })
      }

      if ('error' in res && res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const inputClass = 'border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400 w-full'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full max-w-[520px] bg-[var(--bg-surface)] shadow-2xl z-50 flex flex-col">

        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
            {isEditing ? `Editar: ${item.name}` : 'Nuevo plato'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Nombre *</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Paella Valenciana" className={inputClass} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Descripción</span>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Descripción breve del plato" className={inputClass + ' resize-none'} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Categoría</span>
                  <button
                    type="button"
                    onClick={() => setShowNewCat(v => !v)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {showNewCat ? 'Cancelar' : '+ Nueva'}
                  </button>
                </div>
                {showNewCat ? (
                  <div className="flex gap-1">
                    <input
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory() } }}
                      placeholder="Nombre categoría"
                      autoFocus
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={catPending || !newCatName.trim()}
                      className="px-2 py-1 text-xs bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 whitespace-nowrap"
                    >
                      {catPending ? '...' : 'Crear'}
                    </button>
                  </div>
                ) : (
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass}>
                    <option value="">Sin categoría</option>
                    {localCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Precio de venta (€)</span>
                <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" min="0" className={inputClass} />
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Foto</span>
              <div className="flex gap-2">
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="URL de imagen (o sube una)"
                  className={inputClass}
                />
                <label className="flex-shrink-0 cursor-pointer px-3 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)] whitespace-nowrap">
                  {imageUploading ? '...' : 'Subir'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file)
                    }}
                  />
                </label>
              </div>
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="preview" className="h-20 w-20 object-cover rounded-lg border border-[var(--border)] mt-1" />
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-[var(--text-primary)]">Cantidad mínima por pedido</div>
              <input
                type="number"
                min={1}
                step={1}
                value={cantidadMinima}
                onChange={e => setCantidadMinima(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-[var(--text-primary)]">Disponible en carta</span>
            </label>
          </div>

          <div className="bg-[var(--bg-page)] rounded-xl p-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[var(--text-secondary)]">Coste total</div>
              <div className="text-base font-bold text-[var(--text-primary)]">{totalCost.toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">Margen</div>
              <div className={`text-base ${marginTextClass(margin)}`}>{margin.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">Beneficio bruto</div>
              <div className="text-base font-bold text-[var(--text-primary)]">{(priceNum - totalCost).toFixed(2)} €</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              Ingredientes ({ingredients.length})
            </div>

            <div className="flex flex-col gap-2 mb-3">
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={ingDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIngDropdownOpen(v => !v)}
                    className={`w-full text-left border rounded-lg px-3 py-2 text-sm outline-none transition-colors flex items-center justify-between gap-2 ${
                      ingDropdownOpen ? 'border-blue-400' : 'border-[var(--border)]'
                    } ${selectedProductId ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                  >
                    <span className="truncate">{selectedProductId ? selectedProductName : 'Seleccionar ingrediente…'}</span>
                    <span className="text-[var(--text-secondary)] text-xs flex-shrink-0">{ingDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                  {ingDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-lg z-20 mt-1 flex flex-col">
                      <div className="p-2 border-b border-[var(--border)]">
                        <input
                          autoFocus
                          value={ingSearch}
                          onChange={e => setIngSearch(e.target.value)}
                          placeholder="Buscar ingrediente…"
                          className="w-full border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-[var(--text-secondary)] text-center">Sin resultados</p>
                        ) : (
                          filteredProducts.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => selectProduct(p)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-page)] flex items-center justify-between gap-2"
                            >
                              <span className="font-medium text-[var(--text-primary)]">{p.name}</span>
                              <span className="text-xs text-[var(--text-secondary)]">
                                {p.cost_price !== null ? `${p.cost_price.toFixed(2)} €/${p.unit}` : 'sin coste'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  value={ingQty}
                  onChange={e => setIngQty(e.target.value)}
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="Cant."
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400 w-20"
                />
                <select
                  value={ingUnit}
                  onChange={e => setIngUnit(e.target.value)}
                  className="border border-[var(--border)] rounded-lg px-2 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400"
                >
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  onClick={addIngredient}
                  disabled={!selectedProductId}
                  className="px-3 py-2 text-sm bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 whitespace-nowrap"
                >
                  + Añadir
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              {ingredients.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] py-2 text-center">Sin ingredientes</p>
              )}
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2 py-2 px-3 bg-[var(--bg-page)] rounded-lg">
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{ing.productName}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{ing.quantity} {ing.unit}</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    = {(ing.costPrice * ing.quantity).toFixed(3)} €
                  </span>
                  <button
                    onClick={() => removeIngredient(idx)}
                    className="text-red-400 hover:text-red-600 text-sm font-bold ml-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Variantes y modificadores — solo cuando el plato ya existe */}
          {isEditing && item?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 mt-2">
              <GestorModificadores menuItemId={item.id} menuItemName={item.name ?? ''} />
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)]">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || imageUploading}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plato'}
          </button>
        </div>
      </div>
    </>
  )
}
