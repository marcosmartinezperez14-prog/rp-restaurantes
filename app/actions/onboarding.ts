'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ZoneInput = {
  id?: string
  name: string
  tables: { id?: string; number: number }[]
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
    ? await supabase.from('tables').select('id, zone_id, number').in('zone_id', zoneIds)
    : { data: [] as { id: string; zone_id: string; number: number }[] }

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
      .map(t => ({ id: t.id, number: t.number })),
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

  if (!data.name.trim()) return { error: 'El nombre del restaurante es obligatorio.' }

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

  for (const zone of zones) {
    let zoneId = zone.id
    if (zoneId) {
      await supabase.from('zones').update({ name: zone.name }).eq('id', zoneId)
    } else {
      const { data: newZone } = await supabase
        .from('zones')
        .insert({ restaurant_id: restaurantId, name: zone.name })
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

    for (const table of zone.tables) {
      if (table.id) {
        await supabase.from('tables').update({ number: table.number }).eq('id', table.id)
      } else {
        await supabase.from('tables').insert({ zone_id: zoneId, number: table.number })
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

  for (const category of categories) {
    let categoryId = category.id
    if (categoryId) {
      await supabase.from('categories').update({ name: category.name }).eq('id', categoryId)
    } else {
      const { data: newCategory } = await supabase
        .from('categories')
        .insert({ restaurant_id: restaurantId, name: category.name })
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

    for (const product of category.products) {
      if (product.id) {
        await supabase
          .from('products')
          .update({ name: product.name, price: product.price })
          .eq('id', product.id)
      } else {
        await supabase.from('products').insert({
          category_id: categoryId,
          name: product.name,
          price: product.price,
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
