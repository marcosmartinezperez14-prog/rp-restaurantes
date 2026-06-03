'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProductoConCategoria = {
  id: string
  name: string
  price: number
  cost_price: number | null
  tax_rate: number
  is_available: boolean
  is_visible: boolean
  track_stock: boolean
  stock: number | null
  stock_min: number | null
  supplier: string | null
  last_purchase_date: string | null
  categories: { id: string; name: string }[]
}

export type StockMovement = {
  id: string
  product_id: string
  type: 'compra' | 'venta' | 'ajuste' | 'merma'
  quantity: number
  cost_price: number | null
  purchase_date: string | null
  notes: string | null
  created_at: string
}

export type Categoria = {
  id: string
  name: string
  position: number
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getRestaurantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('id', userId)
    .single()
  return data?.restaurant_id ?? null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getProductos(): Promise<ProductoConCategoria[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('products')
    .select(`
      id, name, price, cost_price, tax_rate, is_available, is_visible,
      track_stock, stock, stock_min, supplier, last_purchase_date,
      product_categories(category_id, categories(id, name))
    `)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('name')

  type PCRow = { category_id: string; categories: { id: string; name: string } | null }

  return (data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    cost_price: p.cost_price !== null ? Number(p.cost_price) : null,
    tax_rate: Number(p.tax_rate),
    is_available: p.is_available,
    is_visible: p.is_visible,
    track_stock: p.track_stock ?? false,
    stock: p.stock !== null ? Number(p.stock) : null,
    stock_min: p.stock_min !== null ? Number(p.stock_min) : null,
    supplier: p.supplier ?? null,
    last_purchase_date: p.last_purchase_date ?? null,
    categories: ((p.product_categories ?? []) as unknown as PCRow[]).map(pc => ({
      id: pc.category_id,
      name: pc.categories?.name ?? '—',
    })),
  }))
}

export async function updateProducto(
  productId: string,
  data: {
    price?: number
    cost_price?: number | null
    stock_min?: number | null
    supplier?: string | null
    track_stock?: boolean
    is_available?: boolean
    is_visible?: boolean
    categoryIds?: string[]
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { categoryIds, ...productData } = data

  if (Object.keys(productData).length > 0) {
    const { error } = await supabase
      .from('products')
      .update({ ...productData, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('restaurant_id', restaurantId)
    if (error) return { error: error.message }
  }

  if (categoryIds !== undefined) {
    const { error: delErr } = await supabase
      .from('product_categories')
      .delete()
      .eq('product_id', productId)
      .eq('restaurant_id', restaurantId)
    if (delErr) return { error: delErr.message }

    if (categoryIds.length > 0) {
      const { error: insErr } = await supabase
        .from('product_categories')
        .insert(categoryIds.map(cid => ({
          product_id: productId,
          category_id: cid,
          restaurant_id: restaurantId,
        })))
      if (insErr) return { error: insErr.message }
    }
  }

  return {}
}

export async function registrarCompra(params: {
  productId: string
  quantity: number
  costPrice: number
  purchaseDate: string
  notes?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (params.quantity <= 0) return { error: 'La cantidad debe ser mayor que 0' }
  if (params.costPrice < 0) return { error: 'El precio no puede ser negativo' }

  const { error: movErr } = await supabase.from('stock_movements').insert({
    restaurant_id: restaurantId,
    product_id: params.productId,
    type: 'compra',
    quantity: params.quantity,
    cost_price: params.costPrice,
    purchase_date: params.purchaseDate,
    notes: params.notes ?? null,
    created_by: user.id,
  })

  if (movErr) return { error: movErr.message }

  const { data: current } = await supabase
    .from('products')
    .select('stock')
    .eq('id', params.productId)
    .single()

  const newStock = (Number(current?.stock) || 0) + params.quantity

  const { error: updErr } = await supabase
    .from('products')
    .update({
      stock: newStock,
      cost_price: params.costPrice,
      last_purchase_date: params.purchaseDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.productId)
    .eq('restaurant_id', restaurantId)

  if (updErr) return { error: updErr.message }
  return {}
}

export async function ajustarStock(params: {
  productId: string
  type: 'ajuste' | 'merma'
  quantity: number
  notes?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data: current } = await supabase
    .from('products')
    .select('stock')
    .eq('id', params.productId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!current) return { error: 'Producto no encontrado' }

  const delta = params.type === 'merma' ? -Math.abs(params.quantity) : params.quantity
  const newStock = (Number(current.stock) || 0) + delta

  const { error: movErr } = await supabase.from('stock_movements').insert({
    restaurant_id: restaurantId,
    product_id: params.productId,
    type: params.type,
    quantity: params.quantity,
    cost_price: null,
    purchase_date: null,
    notes: params.notes ?? null,
    created_by: user.id,
  })

  if (movErr) return { error: movErr.message }

  const { error: updErr } = await supabase
    .from('products')
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq('id', params.productId)
    .eq('restaurant_id', restaurantId)

  if (updErr) return { error: updErr.message }
  return {}
}

export async function getStockMovements(productId: string): Promise<StockMovement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('stock_movements')
    .select('id, product_id, type, quantity, cost_price, purchase_date, notes, created_at')
    .eq('product_id', productId)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []).map(m => ({
    id: m.id,
    product_id: m.product_id,
    type: m.type as StockMovement['type'],
    quantity: Number(m.quantity),
    cost_price: m.cost_price !== null ? Number(m.cost_price) : null,
    purchase_date: m.purchase_date ?? null,
    notes: m.notes ?? null,
    created_at: m.created_at,
  }))
}

export async function getCategorias(): Promise<Categoria[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  return (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    position: c.position ?? 0,
  }))
}

export async function createProduct(params: {
  name: string
  categoryIds: string[]
  description?: string
  price: number
  costPrice?: number
  taxRate: number
  stock: number
  stockMin: number
  trackStock: boolean
  supplier?: string
  sku?: string
  isAvailable: boolean
  isVisible: boolean
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  if (!params.name.trim()) return { error: 'El nombre es obligatorio' }
  if (params.price <= 0) return { error: 'El precio de venta debe ser mayor que 0' }
  if (params.costPrice !== undefined && params.costPrice < 0) {
    return { error: 'El precio de compra no puede ser negativo' }
  }

  const { data: product, error: insertErr } = await supabase
    .from('products')
    .insert({
      restaurant_id: restaurantId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      price: params.price,
      cost_price: params.costPrice ?? null,
      tax_rate: params.taxRate,
      stock: params.stock,
      stock_min: params.stockMin,
      track_stock: params.trackStock,
      supplier: params.supplier?.trim() || null,
      sku: params.sku?.trim() || null,
      is_available: params.isAvailable,
      is_visible: params.isVisible,
    })
    .select('id')
    .single()

  if (insertErr || !product) {
    return { error: insertErr?.message ?? 'No se pudo crear el producto' }
  }

  if (params.categoryIds.length > 0) {
    const { error: catErr } = await supabase
      .from('product_categories')
      .insert(params.categoryIds.map(cid => ({
        product_id: product.id,
        category_id: cid,
        restaurant_id: restaurantId,
      })))
    if (catErr) return { error: catErr.message }
  }

  if (params.trackStock && params.stock > 0) {
    const { error: movErr } = await supabase.from('stock_movements').insert({
      restaurant_id: restaurantId,
      product_id: product.id,
      type: 'ajuste',
      quantity: params.stock,
      cost_price: params.costPrice ?? null,
      purchase_date: null,
      notes: 'Stock inicial',
      created_by: user.id,
    })
    if (movErr) return { error: `Producto creado pero error al registrar stock: ${movErr.message}` }
  }

  return { success: true }
}

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

export async function editarStock(
  productId: string,
  newStock: number
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data: current } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!current) return { error: 'Producto no encontrado' }

  const delta = newStock - (Number(current.stock) || 0)

  const { error: updErr } = await supabase
    .from('products')
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('restaurant_id', restaurantId)

  if (updErr) return { error: updErr.message }

  if (delta !== 0) {
    await supabase.from('stock_movements').insert({
      restaurant_id: restaurantId,
      product_id: productId,
      type: 'ajuste',
      quantity: Math.abs(delta),
      cost_price: null,
      purchase_date: null,
      notes: delta > 0 ? 'Ajuste manual (+)' : 'Ajuste manual (-)',
      created_by: user.id,
    })
  }

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
    .from('product_categories')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('restaurant_id', restaurantId)

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
