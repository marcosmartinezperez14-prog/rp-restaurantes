'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProductUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'dozen'

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
  unit: ProductUnit
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

export type MovimientoGlobal = {
  id: string
  product_id: string
  product_name: string
  type: 'compra' | 'venta' | 'ajuste' | 'merma'
  quantity: number
  cost_price: number | null
  purchase_date: string | null
  notes: string | null
  created_at: string
}

export type StockStats = {
  compras: { total: number; count: number }
  ventas:  { total: number; count: number }
  ajustes: { total: number; count: number }
  mermas:  { total: number; count: number }
}

export type Categoria = {
  id: string
  name: string
  position: number
}

export type MenuItemIngredient = {
  id: string
  menu_item_id: string
  product_id: string
  restaurant_id: string
  quantity: number
  unit: string
  product?: {
    id: string
    name: string
    cost_price: number | null
    unit: ProductUnit
  }
}

export type MenuItem = {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
  cantidad_minima: number
  deleted_at: string | null
  created_at: string
  updated_at: string
  category?: { name: string }
  ingredients: MenuItemIngredient[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const ROLES_CON_EDICION = ['admin', 'gerente']

async function puedeEditar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('user_roles!user_id(roles(name))')
    .eq('id', userId)
    .single()
  const roles = data?.user_roles as { roles: { name: string } | null }[] | undefined
  const rol = roles?.[0]?.roles?.name ?? null
  return !rol || ROLES_CON_EDICION.includes(rol)
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
      track_stock, stock, stock_min, unit, supplier, last_purchase_date,
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
    unit: (p.unit as ProductUnit) ?? 'unit',
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
    unit?: ProductUnit
    categoryIds?: string[]
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

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
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

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
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

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
  price?: number
  costPrice?: number
  taxRate: number
  stock: number
  stockMin: number
  trackStock: boolean
  supplier?: string
  sku?: string
  isAvailable: boolean
  isVisible: boolean
  unit?: ProductUnit
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

  if (!params.name.trim()) return { error: 'El nombre es obligatorio' }
  if (params.costPrice !== undefined && params.costPrice < 0) {
    return { error: 'El precio de compra no puede ser negativo' }
  }

  const { data: product, error: insertErr } = await supabase
    .from('products')
    .insert({
      restaurant_id: restaurantId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      price: params.price ?? 0,
      cost_price: params.costPrice ?? null,
      tax_rate: params.taxRate,
      stock: params.stock,
      stock_min: params.stockMin,
      track_stock: params.trackStock,
      supplier: params.supplier?.trim() || null,
      sku: params.sku?.trim() || null,
      is_available: params.isAvailable,
      is_visible: params.isVisible,
      unit: params.unit ?? 'unit',
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
): Promise<{ id: string; name: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

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

  const { data: newCat, error } = await supabase
    .from('categories')
    .insert({ restaurant_id: restaurantId, name: name.trim(), position })
    .select('id, name')
    .single()

  if (error || !newCat) return { error: error?.message ?? 'No se pudo crear la categoría' }
  return { id: newCat.id, name: newCat.name }
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
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

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
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

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
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

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

export async function getMovimientosGlobal(params: {
  tipo?: 'compra' | 'venta' | 'ajuste' | 'merma'
  productoId?: string
  fechaDesde?: string   // 'YYYY-MM-DD'
  fechaHasta?: string   // 'YYYY-MM-DD'
  page: number
  pageSize?: number
}): Promise<{ movements: MovimientoGlobal[]; total: number; stats: StockStats }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const pageSize = params.pageSize ?? 50
  const safePage = Math.max(1, params.page)
  const from = (safePage - 1) * pageSize
  const to = from + pageSize - 1

  // Lightweight query for stats (no product join, no range limit)
  let statsQ = supabase
    .from('stock_movements')
    .select('type, quantity')
    .eq('restaurant_id', restaurantId)
    .limit(10000)

  if (params.tipo)       statsQ = statsQ.eq('type', params.tipo)
  if (params.productoId) statsQ = statsQ.eq('product_id', params.productoId)
  if (params.fechaDesde) statsQ = statsQ.gte('created_at', params.fechaDesde)
  if (params.fechaHasta) statsQ = statsQ.lte('created_at', `${params.fechaHasta}T23:59:59.999`)

  // Count-only query for accurate total (not capped by limit)
  let countQ = supabase
    .from('stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)

  if (params.tipo)       countQ = countQ.eq('type', params.tipo)
  if (params.productoId) countQ = countQ.eq('product_id', params.productoId)
  if (params.fechaDesde) countQ = countQ.gte('created_at', params.fechaDesde)
  if (params.fechaHasta) countQ = countQ.lte('created_at', `${params.fechaHasta}T23:59:59.999`)

  // Paginated query with product name join
  let dataQ = supabase
    .from('stock_movements')
    .select('id, product_id, type, quantity, cost_price, purchase_date, notes, created_at, products(name)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.tipo)       dataQ = dataQ.eq('type', params.tipo)
  if (params.productoId) dataQ = dataQ.eq('product_id', params.productoId)
  if (params.fechaDesde) dataQ = dataQ.gte('created_at', params.fechaDesde)
  if (params.fechaHasta) dataQ = dataQ.lte('created_at', `${params.fechaHasta}T23:59:59.999`)

  const [{ data: statsData }, { count }, { data }] = await Promise.all([statsQ, countQ, dataQ])

  const stats: StockStats = {
    compras: { total: 0, count: 0 },
    ventas:  { total: 0, count: 0 },
    ajustes: { total: 0, count: 0 },
    mermas:  { total: 0, count: 0 },
  }
  const keyMap: Record<string, keyof StockStats> = {
    compra: 'compras', venta: 'ventas', ajuste: 'ajustes', merma: 'mermas',
  }
  for (const row of (statsData ?? [])) {
    const key = keyMap[row.type]
    if (key) {
      stats[key].total += Number(row.quantity)
      stats[key].count += 1
    }
  }

  const movements: MovimientoGlobal[] = (data ?? []).map(m => {
    const prod = m.products
    return {
      id: m.id,
      product_id: m.product_id,
      product_name: (Array.isArray(prod)
        ? (prod[0] as { name: string } | undefined)?.name
        : (prod as { name: string } | null)?.name) ?? '—',
      type: m.type as MovimientoGlobal['type'],
      quantity: Number(m.quantity),
      cost_price: m.cost_price !== null ? Number(m.cost_price) : null,
      purchase_date: m.purchase_date ?? null,
      notes: m.notes ?? null,
      created_at: m.created_at,
    }
  })

  return { movements, total: count ?? 0, stats }
}

export async function getMenuItems(): Promise<MenuItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('menu_items')
    .select(`
      id, restaurant_id, category_id, name, description, price,
      image_url, is_active, cantidad_minima, deleted_at, created_at, updated_at,
      categories(name),
      menu_item_ingredients(
        id, menu_item_id, product_id, restaurant_id, quantity, unit,
        products(id, name, cost_price, unit)
      )
    `)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('name')

  return (data ?? []).map(item => ({
    id: item.id,
    restaurant_id: item.restaurant_id,
    category_id: item.category_id ?? null,
    name: item.name,
    description: item.description ?? null,
    price: Number(item.price),
    image_url: item.image_url ?? null,
    is_active: item.is_active,
    cantidad_minima: Number(item.cantidad_minima) || 1,
    deleted_at: item.deleted_at ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    category: item.categories ? { name: (item.categories as unknown as { name: string }).name } : undefined,
    ingredients: ((item.menu_item_ingredients ?? []) as unknown as Array<{
      id: string; menu_item_id: string; product_id: string; restaurant_id: string
      quantity: number | string; unit: string
      products: { id: string; name: string; cost_price: number | null; unit: string } | null
    }>).map(ing => ({
      id: ing.id,
      menu_item_id: ing.menu_item_id,
      product_id: ing.product_id,
      restaurant_id: ing.restaurant_id,
      quantity: Number(ing.quantity),
      unit: ing.unit,
      product: ing.products ? {
        id: ing.products.id,
        name: ing.products.name,
        cost_price: ing.products.cost_price !== null ? Number(ing.products.cost_price) : null,
        unit: ing.products.unit as ProductUnit,
      } : undefined,
    })),
  }))
}

export async function createMenuItem(params: {
  name: string
  description?: string
  categoryId?: string
  price: number
  imageUrl?: string
  isActive: boolean
  cantidadMinima?: number
  ingredients: { productId: string; quantity: number; unit: string }[]
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

  if (!params.name.trim()) return { error: 'El nombre es obligatorio' }
  if (params.price < 0) return { error: 'El precio no puede ser negativo' }

  const { data: item, error: insertErr } = await supabase
    .from('menu_items')
    .insert({
      restaurant_id: restaurantId,
      category_id: params.categoryId || null,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      price: params.price,
      image_url: params.imageUrl || null,
      is_active: params.isActive,
      cantidad_minima: params.cantidadMinima ?? 1,
    })
    .select('id')
    .single()

  if (insertErr || !item) return { error: insertErr?.message ?? 'No se pudo crear el plato' }

  if (params.ingredients.length > 0) {
    const { error: ingErr } = await supabase
      .from('menu_item_ingredients')
      .insert(params.ingredients.map(ing => ({
        menu_item_id: item.id,
        product_id: ing.productId,
        restaurant_id: restaurantId,
        quantity: ing.quantity,
        unit: ing.unit,
      })))
    if (ingErr) return { error: `Plato creado pero error en ingredientes: ${ingErr.message}` }
  }

  return { success: true }
}

export async function updateMenuItem(
  itemId: string,
  params: {
    name?: string
    description?: string | null
    categoryId?: string | null
    price?: number
    imageUrl?: string | null
    isActive?: boolean
    cantidadMinima?: number
    ingredients?: { productId: string; quantity: number; unit: string }[]
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (params.name !== undefined) updateData.name = params.name.trim()
  if (params.description !== undefined) updateData.description = params.description?.trim() || null
  if (params.categoryId !== undefined) updateData.category_id = params.categoryId || null
  if (params.price !== undefined) updateData.price = params.price
  if (params.imageUrl !== undefined) updateData.image_url = params.imageUrl || null
  if (params.isActive !== undefined) updateData.is_active = params.isActive
  if (params.cantidadMinima !== undefined) updateData.cantidad_minima = params.cantidadMinima

  const { error: updateErr } = await supabase
    .from('menu_items')
    .update(updateData)
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
  if (updateErr) return { error: updateErr.message }

  if (params.ingredients !== undefined) {
    const { error: delErr } = await supabase
      .from('menu_item_ingredients')
      .delete()
      .eq('menu_item_id', itemId)
      .eq('restaurant_id', restaurantId)
    if (delErr) return { error: delErr.message }

    if (params.ingredients.length > 0) {
      const { error: ingErr } = await supabase
        .from('menu_item_ingredients')
        .insert(params.ingredients.map(ing => ({
          menu_item_id: itemId,
          product_id: ing.productId,
          restaurant_id: restaurantId,
          quantity: ing.quantity,
          unit: ing.unit,
        })))
      if (ingErr) return { error: ingErr.message }
    }
  }

  return {}
}

export async function deleteMenuItem(itemId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')
  if (!await puedeEditar(supabase, user.id)) return { error: 'Sin permisos' }

  const { error } = await supabase
    .from('menu_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return {}
}
