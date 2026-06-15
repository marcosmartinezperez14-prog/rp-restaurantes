'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const zoneInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  tables: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
  })),
})

const categoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  products: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    price: z.number().min(0).max(1_000_000),
  })),
})

const restaurantDataSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del restaurante es obligatorio.').max(160),
  address: z.string().max(300),
  phone: z.string().max(30),
  schedule: z.string().max(2000),
})

export type ZoneInput = {
  id?: string
  name: string
  tables: { id?: string; name: string }[]
}

export type CategoryInput = {
  id?: string
  name: string
  products: { id?: string; name: string; price: number }[]
}

export type OnboardingData = {
  restaurant: {
    id: string
    name: string
    address: string | null
    phone: string | null
    schedule: string | null
    onboarding_step: number
    onboarding_completed: boolean
  }
  zones: ZoneInput[]
  categories: CategoryInput[]
}

type ActionResult = { error?: string } | undefined

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

export async function getOnboardingData(): Promise<OnboardingData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, address, phone, schedule, onboarding_step, onboarding_completed')
    .eq('id', restaurantId)
    .single()

  if (restaurantError) console.error('[onboarding] restaurant error:', restaurantError.message)

  const { data: zonesData } = await supabase
    .from('zones')
    .select('id, name')
    .eq('restaurant_id', restaurantId)

  const zoneIds = (zonesData ?? []).map(z => z.id)

  const { data: tablesData } = zoneIds.length > 0
    ? await supabase.from('tables').select('id, zone_id, name').in('zone_id', zoneIds)
    : { data: [] as { id: string; zone_id: string; name: string }[] }

  const { data: categoriesData } = await supabase
    .from('categories')
    .select('id, name')
    .eq('restaurant_id', restaurantId)

  const categoryIds = (categoriesData ?? []).map(c => c.id)

  const { data: productsData } = categoryIds.length > 0
    ? await supabase.from('products').select('id, category_id, name, price').in('category_id', categoryIds)
    : { data: [] as { id: string; category_id: string; name: string; price: number }[] }

  const zones: ZoneInput[] = (zonesData ?? []).map(z => ({
    id: z.id,
    name: z.name,
    tables: (tablesData ?? [])
      .filter(t => t.zone_id === z.id)
      .map(t => ({ id: t.id, name: t.name })),
  }))

  const categories: CategoryInput[] = (categoriesData ?? []).map(c => ({
    id: c.id,
    name: c.name,
    products: (productsData ?? [])
      .filter(p => p.category_id === c.id)
      .map(p => ({ id: p.id, name: p.name, price: p.price })),
  }))

  if (!restaurant) redirect('/login')

  return { restaurant, zones, categories }
}

export async function saveRestaurantData(data: {
  name: string
  address: string
  phone: string
  schedule: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Ha ocurrido un error inesperado.' }

  const validated = restaurantDataSchema.safeParse(data)
  if (!validated.success) return { error: validated.error.issues[0]?.message ?? 'Datos no válidos' }
  data = validated.data

  const { error } = await supabase
    .from('restaurants')
    .update({
      name: data.name.trim(),
      address: data.address.trim() || null,
      phone: data.phone.trim() || null,
      schedule: data.schedule.trim() || null,
      onboarding_step: 2,
    })
    .eq('id', restaurantId)

  if (error) return { error: 'Ha ocurrido un error al guardar los datos.' }
}

export async function saveZonesAndTables(zones: ZoneInput[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Ha ocurrido un error inesperado.' }

  const validated = z.array(zoneInputSchema).safeParse(zones)
  if (!validated.success) return { error: 'Datos no válidos' }
  zones = validated.data

  if (zones.length === 0 || zones.some(z => z.tables.length === 0)) {
    return { error: 'Debe haber al menos 1 zona con 1 mesa.' }
  }

  const { data: existingZones } = await supabase
    .from('zones')
    .select('id')
    .eq('restaurant_id', restaurantId)

  const existingZoneIds = (existingZones ?? []).map(z => z.id as string)
  const incomingZoneIds = zones.filter(z => z.id).map(z => z.id!)

  const zoneIdsToDelete = existingZoneIds.filter(id => !incomingZoneIds.includes(id))
  if (zoneIdsToDelete.length > 0) {
    await supabase.from('tables').delete().in('zone_id', zoneIdsToDelete)
    await supabase.from('zones').delete().in('id', zoneIdsToDelete)
  }

  for (const [zonePos, zone] of zones.entries()) {
    let zoneId = zone.id
    if (zoneId) {
      await supabase.from('zones').update({ name: zone.name }).eq('id', zoneId)
    } else {
      const { data: newZone } = await supabase
        .from('zones')
        .insert({
          restaurant_id: restaurantId,
          name: zone.name,
          color: '#94a3b8',
          is_active: true,
          position: zonePos,
        })
        .select('id')
        .single()
      zoneId = newZone?.id
    }
    if (!zoneId) continue

    const { data: existingTables } = await supabase
      .from('tables')
      .select('id')
      .eq('zone_id', zoneId)
    const existingTableIds = (existingTables ?? []).map(t => t.id as string)
    const incomingTableIds = zone.tables.filter(t => t.id).map(t => t.id!)

    const tableIdsToDelete = existingTableIds.filter(id => !incomingTableIds.includes(id))
    if (tableIdsToDelete.length > 0) {
      await supabase.from('tables').delete().in('id', tableIdsToDelete)
    }

    for (const [tablePos, table] of zone.tables.entries()) {
      if (table.id) {
        await supabase
          .from('tables')
          .update({ name: table.name, position: tablePos })
          .eq('id', table.id)
      } else {
        await supabase.from('tables').insert({
          zone_id: zoneId,
          restaurant_id: restaurantId,
          name: table.name,
          capacity: 4,
          status: 'free',
          is_active: true,
          position: tablePos,
        })
      }
    }
  }

  await supabase.from('restaurants').update({ onboarding_step: 3 }).eq('id', restaurantId)
}

export async function saveMenuData(categories: CategoryInput[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Ha ocurrido un error inesperado.' }

  const validated = z.array(categoryInputSchema).safeParse(categories)
  if (!validated.success) return { error: 'Datos no válidos' }
  categories = validated.data

  const totalProducts = categories.reduce((sum, c) => sum + c.products.length, 0)
  if (totalProducts === 0) return { error: 'Añade al menos 1 producto a tu carta.' }

  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id')
    .eq('restaurant_id', restaurantId)

  const existingCategoryIds = (existingCategories ?? []).map(c => c.id as string)
  const incomingCategoryIds = categories.filter(c => c.id).map(c => c.id!)

  const categoryIdsToDelete = existingCategoryIds.filter(id => !incomingCategoryIds.includes(id))
  if (categoryIdsToDelete.length > 0) {
    await supabase.from('products').delete().in('category_id', categoryIdsToDelete)
    await supabase.from('categories').delete().in('id', categoryIdsToDelete)
  }

  for (const [catPos, category] of categories.entries()) {
    let categoryId = category.id
    if (categoryId) {
      await supabase
        .from('categories')
        .update({ name: category.name, position: catPos })
        .eq('id', categoryId)
    } else {
      const { data: newCategory } = await supabase
        .from('categories')
        .insert({ restaurant_id: restaurantId, name: category.name, position: catPos })
        .select('id')
        .single()
      categoryId = newCategory?.id
    }
    if (!categoryId) continue

    const { data: existingProducts } = await supabase
      .from('products')
      .select('id')
      .eq('category_id', categoryId)
    const existingProductIds = (existingProducts ?? []).map(p => p.id as string)
    const incomingProductIds = category.products.filter(p => p.id).map(p => p.id!)

    const productIdsToDelete = existingProductIds.filter(id => !incomingProductIds.includes(id))
    if (productIdsToDelete.length > 0) {
      await supabase.from('products').delete().in('id', productIdsToDelete)
    }

    for (const [productPos, product] of category.products.entries()) {
      if (product.id) {
        await supabase
          .from('products')
          .update({ name: product.name, price: product.price, position: productPos })
          .eq('id', product.id)
      } else {
        await supabase.from('products').insert({
          category_id: categoryId,
          restaurant_id: restaurantId,
          name: product.name,
          price: product.price,
          tax_rate: 10,
          is_available: true,
          is_visible: true,
          position: productPos,
        })
      }
    }
  }

  await supabase.from('restaurants').update({ onboarding_step: 4 }).eq('id', restaurantId)
}

export async function completeOnboarding(): Promise<never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  await supabase
    .from('restaurants')
    .update({ onboarding_completed: true })
    .eq('id', restaurantId)

  // Persiste el estado en user_metadata para que el proxy lo lea del JWT (sin DB query)
  await supabase.auth.updateUser({ data: { onboarding_completed: true } })

  const cookieStore = await cookies()
  cookieStore.set('sb-onboarding', 'done', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect('/dashboard')
}

export async function getDiagnostics(): Promise<{ raw: unknown; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { raw: null, error: 'Sin restaurante' }

  // Raw zones with ALL columns
  const { data: zones, error: zErr } = await supabase
    .from('zones')
    .select('*')
    .eq('restaurant_id', restaurantId)

  // Raw tables joined through those zones (no restaurant_id filter)
  const zoneIds = (zones ?? []).map((z: Record<string, unknown>) => z.id as string)
  const { data: tables, error: tErr } = zoneIds.length > 0
    ? await supabase.from('tables').select('*').in('zone_id', zoneIds)
    : { data: [], error: null }

  // Raw products from categories
  const { data: cats } = await supabase.from('categories').select('id').eq('restaurant_id', restaurantId)
  const catIds = (cats ?? []).map((c: Record<string, unknown>) => c.id as string)
  const { data: products } = catIds.length > 0
    ? await supabase.from('products').select('*').in('category_id', catIds).limit(3)
    : { data: [] }

  // Probe all table schemas by attempting minimal selects
  const probes: Record<string, unknown> = {}
  for (const tbl of ['orders', 'order_items', 'tickets', 'payments'] as const) {
    const { data, error } = await supabase.from(tbl).select('*').limit(1)
    if (error) {
      probes[tbl] = { error: error.message }
    } else if (data && data.length > 0) {
      probes[tbl] = { columns: Object.keys(data[0]), sample: data[0] }
    } else {
      // Try insert with empty object to get column info from error
      probes[tbl] = { exists: true, empty: true }
    }
  }

  return {
    raw: {
      restaurantId,
      tableCount: (tables ?? []).length,
      tableError: tErr?.message,
      sampleTable: (tables ?? [])[0] ?? null,
      ...probes,
    }
  }
}

// Repairs existing data created by the old onboarding (missing restaurant_id, is_active, etc.)
export async function repairExistingData(): Promise<{ fixed: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { fixed: 0, error: 'No se encontró el restaurante.' }

  let fixed = 0

  // 1. Fix zones: set is_active=true and color if missing
  const { data: zones } = await supabase
    .from('zones')
    .select('id, color, is_active')
    .eq('restaurant_id', restaurantId)

  for (const [i, zone] of (zones ?? []).entries()) {
    const patch: Record<string, unknown> = { position: i }
    if (!zone.is_active) patch.is_active = true
    if (!zone.color) patch.color = '#94a3b8'
    await supabase.from('zones').update(patch).eq('id', zone.id)
    fixed++
  }

  // 2. Fix tables: patch existing ones, create missing ones
  const zoneIds = (zones ?? []).map(z => z.id)
  if (zoneIds.length > 0) {
    const { data: tables } = await supabase
      .from('tables')
      .select('id, zone_id, number, name, status, is_active, capacity, restaurant_id')
      .in('zone_id', zoneIds)

    // Patch existing tables that are missing fields
    for (const [i, table] of (tables ?? []).entries()) {
      const patch: Record<string, unknown> = { position: i }
      if (!table.restaurant_id) patch.restaurant_id = restaurantId
      if (!table.name) patch.name = `Mesa ${table.number}`
      if (!table.status) patch.status = 'free'
      if (!table.is_active) patch.is_active = true
      if (!table.capacity) patch.capacity = 4
      await supabase.from('tables').update(patch).eq('id', table.id)
      fixed++
    }

    // Create default tables for zones that have none
    const zoneIdsWithTables = new Set((tables ?? []).map((t: Record<string, unknown>) => t.zone_id as string))
    const emptyZones = (zones ?? []).filter(z => !zoneIdsWithTables.has(z.id))
    for (const zone of emptyZones) {
      for (let n = 1; n <= 4; n++) {
        const { error: insertErr } = await supabase.from('tables').insert({
          zone_id: zone.id,
          restaurant_id: restaurantId,
          name: `Mesa ${n}`,
          capacity: 4,
          status: 'free',
          is_active: true,
          position: n - 1,
        })
        if (insertErr) {
          console.error('[repairExistingData] insert error:', insertErr.message, insertErr.code)
          return { fixed, error: 'No se pudo reparar los datos.' }
        }
        fixed++
      }
    }
  }

  // 3. Fix products: set restaurant_id, is_visible, is_available, tax_rate
  const { data: categories } = await supabase
    .from('categories')
    .select('id')
    .eq('restaurant_id', restaurantId)

  const categoryIds = (categories ?? []).map(c => c.id)
  if (categoryIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, restaurant_id, is_visible, is_available, tax_rate')
      .in('category_id', categoryIds)

    for (const [i, product] of (products ?? []).entries()) {
      const patch: Record<string, unknown> = { position: i }
      if (!product.restaurant_id) patch.restaurant_id = restaurantId
      if (product.is_visible === null || product.is_visible === undefined) patch.is_visible = true
      if (product.is_available === null || product.is_available === undefined) patch.is_available = true
      if (!product.tax_rate) patch.tax_rate = 10
      await supabase.from('products').update(patch).eq('id', product.id)
      fixed++
    }
  }

  return { fixed }
}
