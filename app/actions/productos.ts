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
  category_id: string
  category_name: string
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
    .select('id, name, price, cost_price, tax_rate, is_available, is_visible, track_stock, stock, stock_min, supplier, last_purchase_date, category_id, categories(name)')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('name')

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
    category_id: p.category_id,
    category_name: (p.categories as unknown as { name: string } | { name: string }[] | null) != null
      ? Array.isArray(p.categories)
        ? (p.categories as { name: string }[])[0]?.name ?? '—'
        : (p.categories as unknown as { name: string }).name ?? '—'
      : '—',
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
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { error } = await supabase
    .from('products')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
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
  categoryId: string
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
  if (!params.categoryId) return { error: 'Selecciona una categoría' }
  if (params.price <= 0) return { error: 'El precio de venta debe ser mayor que 0' }
  if (params.costPrice !== undefined && params.costPrice < 0) {
    return { error: 'El precio de compra no puede ser negativo' }
  }

  const { data: maxPosRow } = await supabase
    .from('products')
    .select('position')
    .eq('restaurant_id', restaurantId)
    .eq('category_id', params.categoryId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxPosRow?.position ?? -1) + 1

  const { data: product, error: insertErr } = await supabase
    .from('products')
    .insert({
      restaurant_id: restaurantId,
      category_id: params.categoryId,
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
      position,
    })
    .select('id')
    .single()

  if (insertErr || !product) {
    return { error: insertErr?.message ?? 'No se pudo crear el producto' }
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
