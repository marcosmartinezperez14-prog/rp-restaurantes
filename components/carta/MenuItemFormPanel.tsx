'use client'

import { useState, useTransition, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem, ProductoConCategoria, Categoria } from '@/app/actions/productos'
import { createMenuItem, updateMenuItem } from '@/app/actions/productos'

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
  categories: Categoria[]
  allProducts: ProductoConCategoria[]
  onClose: () => void
  onSaved: () => void
}

export default function MenuItemFormPanel({ item, categories, allProducts, onClose, onSaved }: Props) {
  const isEditing = !!item

  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '')
  const [price, setPrice] = useState(item?.price.toFixed(2) ?? '')
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '')
  const [isActive, setIsActive] = useState(item?.is_active ?? true)
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    (item?.ingredients ?? []).map(ing => ({
      productId: ing.product_id,
      productName: ing.product?.name ?? ing.product_id,
      quantity: ing.quantity,
      unit: ing.unit,
      costPrice: ing.product?.cost_price ?? 0,
    }))
  )

  const [ingSearch, setIngSearch] = useState('')
  const [ingQty, setIngQty] = useState('1')
  const [ingUnit, setIngUnit] = useState('unit')
  const [selectedProductId, setSelectedProductId] = useState('')

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
    if (!ingSearch.trim()) return []
    const q = ingSearch.toLowerCase()
    return allProducts
      .filter(p => p.name.toLowerCase().includes(q) && !ingredients.find(i => i.productId === p.id))
      .slice(0, 8)
  }, [ingSearch, allProducts, ingredients])

  function selectProduct(product: ProductoConCategoria) {
    setSelectedProductId(product.id)
    setIngSearch(product.name)
    setIngUnit(product.unit)
  }

  function addIngredient() {
    const qty = parseFloat(ingQty.replace(',', '.'))
    if (!selectedProductId) { setError('Selecciona un producto de la lista'); return }
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
    setIngSearch('')
    setIngQty('1')
    setSelectedProductId('')
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
          categoryId: categoryId || null,
          price: priceNum,
          imageUrl: imageUrl || null,
          isActive,
          ingredients: ingPayload,
        })
      } else {
        res = await createMenuItem({
          name,
          description: description || undefined,
          categoryId: categoryId || undefined,
          price: priceNum,
          imageUrl: imageUrl || undefined,
          isActive,
          ingredients: ingPayload,
        })
      }

      if ('error' in res && res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const inputClass = 'border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 w-full'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-2xl z-50 flex flex-col">

        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-shrink-0">
          <h2 className="text-[15px] font-bold text-[#0f172a]">
            {isEditing ? `Editar: ${item.name}` : 'Nuevo plato'}
          </h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#0f172a] text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Nombre *</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Paella Valenciana" className={inputClass} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Descripción</span>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Descripción breve del plato" className={inputClass + ' resize-none'} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#64748b]">Categoría</span>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#64748b]">Precio de venta (€)</span>
                <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" min="0" className={inputClass} />
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#64748b]">Foto</span>
              <div className="flex gap-2">
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="URL de imagen (o sube una)"
                  className={inputClass}
                />
                <label className="flex-shrink-0 cursor-pointer px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 whitespace-nowrap">
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
                <img src={imageUrl} alt="preview" className="h-20 w-20 object-cover rounded-lg border border-[#e2e8f0] mt-1" />
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-[#0f172a]">Disponible en carta</span>
            </label>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#64748b]">Coste total</div>
              <div className="text-base font-bold text-[#0f172a]">{totalCost.toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-xs text-[#64748b]">Margen</div>
              <div className={`text-base ${marginTextClass(margin)}`}>{margin.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-[#64748b]">Beneficio bruto</div>
              <div className="text-base font-bold text-[#0f172a]">{(priceNum - totalCost).toFixed(2)} €</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-2">
              Ingredientes ({ingredients.length})
            </div>

            <div className="flex flex-col gap-2 mb-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    value={ingSearch}
                    onChange={e => { setIngSearch(e.target.value); setSelectedProductId('') }}
                    placeholder="Buscar producto base..."
                    className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 w-full"
                  />
                  {filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                      {filteredProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => selectProduct(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                        >
                          <span className="font-medium text-[#0f172a]">{p.name}</span>
                          <span className="text-xs text-[#94a3b8]">
                            {p.cost_price !== null ? `${p.cost_price.toFixed(2)} €/${p.unit}` : 'sin coste'}
                          </span>
                        </button>
                      ))}
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
                  className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400 w-20"
                />
                <select
                  value={ingUnit}
                  onChange={e => setIngUnit(e.target.value)}
                  className="border border-[#e2e8f0] rounded-lg px-2 py-2 text-sm text-[#0f172a] outline-none focus:border-blue-400"
                >
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  onClick={addIngredient}
                  disabled={!selectedProductId}
                  className="px-3 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
                >
                  + Añadir
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              {ingredients.length === 0 && (
                <p className="text-sm text-[#94a3b8] py-2 text-center">Sin ingredientes</p>
              )}
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="flex-1 text-sm font-medium text-[#0f172a]">{ing.productName}</span>
                  <span className="text-xs text-[#64748b]">{ing.quantity} {ing.unit}</span>
                  <span className="text-xs text-[#94a3b8]">
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

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-[#e2e8f0] flex gap-2 justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || imageUploading}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plato'}
          </button>
        </div>
      </div>
    </>
  )
}
