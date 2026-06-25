'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'

const uuid = z.string().uuid()

function dbError(ctx: string, e: { message?: string } | null, publicMsg: string): { error: string } {
  console.error(`[menus:${ctx}]`, e?.message)
  return { error: publicMsg }
}

async function puedeEditar(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('user_roles!user_id(roles(name))')
    .eq('id', userId)
    .single()
  const roles = data?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = roles?.[0]?.roles?.name ?? null
  return !rol || ['admin', 'gerente'].includes(rol)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type MenuSectionItem = {
  id: string
  section_id: string
  menu_item_id: string | null
  custom_name: string | null
  is_active: boolean
  sort_order: number
  menu_item: { id: string; name: string; price: number } | null
}

export type MenuSection = {
  id: string
  menu_id: string
  name: string
  sort_order: number
  seleccion: boolean
  items: MenuSectionItem[]
}

export type Menu = {
  id: string
  restaurant_id: string
  name: string
  tipo: 'cerrado' | 'menu_del_dia'
  price: number
  description: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  sections: MenuSection[]
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getMenus(): Promise<Menu[]> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId } = ctx

  const { data } = await supabase
    .from('menus')
    .select(`
      id, restaurant_id, name, tipo, price, description, is_active, deleted_at, created_at, updated_at,
      menu_sections(
        id, menu_id, name, sort_order, seleccion,
        menu_section_items(
          id, section_id, menu_item_id, custom_name, is_active, sort_order,
          menu_items(id, name, price)
        )
      )
    `)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  return (data ?? []).map(m => ({
    id: m.id,
    restaurant_id: m.restaurant_id,
    name: m.name,
    tipo: m.tipo as 'cerrado' | 'menu_del_dia',
    price: Number(m.price),
    description: m.description ?? null,
    is_active: m.is_active,
    deleted_at: m.deleted_at ?? null,
    created_at: m.created_at,
    updated_at: m.updated_at,
    sections: ((m.menu_sections ?? []) as unknown as Array<{
      id: string; menu_id: string; name: string; sort_order: number; seleccion: boolean
      menu_section_items: Array<{
        id: string; section_id: string; menu_item_id: string | null; custom_name: string | null; is_active: boolean; sort_order: number
        menu_items: { id: string; name: string; price: number } | null
      }>
    }>)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({
        id: s.id,
        menu_id: s.menu_id,
        name: s.name,
        sort_order: s.sort_order,
        seleccion: s.seleccion ?? true,
        items: (s.menu_section_items ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(i => ({
            id: i.id,
            section_id: i.section_id,
            menu_item_id: i.menu_item_id ?? null,
            custom_name: i.custom_name ?? null,
            is_active: i.is_active,
            sort_order: i.sort_order,
            menu_item: i.menu_items ? { id: i.menu_items.id, name: i.menu_items.name, price: Number(i.menu_items.price) } : null,
          })),
      })),
  }))
}

// ─── Menu CRUD ────────────────────────────────────────────────────────────────

export async function createMenu(params: {
  name: string
  tipo: 'cerrado' | 'menu_del_dia'
  price: number
  description?: string
}): Promise<{ id: string } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  const v = z.object({
    name: z.string().trim().min(1).max(120),
    tipo: z.enum(['cerrado', 'menu_del_dia']),
    price: z.number().min(0).max(9999),
    description: z.string().max(500).optional(),
  }).safeParse(params)
  if (!v.success) return { error: v.error.issues[0]?.message ?? 'Datos no válidos' }

  const { data, error } = await supabase
    .from('menus')
    .insert({
      restaurant_id: restaurantId,
      name: params.name.trim(),
      tipo: params.tipo,
      price: params.price,
      description: params.description?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) return dbError('createMenu', error, 'No se pudo crear el menú')
  return { id: data.id }
}

export async function updateMenu(
  id: string,
  params: { name?: string; tipo?: 'cerrado' | 'menu_del_dia'; price?: number; description?: string | null }
): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(id).success) return { error: 'Datos no válidos' }

  const updateData: Record<string, unknown> = {}
  if (params.name !== undefined) updateData.name = params.name.trim()
  if (params.tipo !== undefined) updateData.tipo = params.tipo
  if (params.price !== undefined) updateData.price = params.price
  if (params.description !== undefined) updateData.description = params.description?.trim() || null

  const { error } = await supabase
    .from('menus')
    .update(updateData)
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return dbError('updateMenu', error, 'No se pudo actualizar el menú')
  return {}
}

export async function toggleMenuActive(id: string, is_active: boolean): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(id).success) return { error: 'Datos no válidos' }

  const { error } = await supabase
    .from('menus')
    .update({ is_active })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return dbError('toggleMenuActive', error, 'No se pudo actualizar el menú')
  return {}
}

export async function deleteMenu(id: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(id).success) return { error: 'Datos no válidos' }

  const { error } = await supabase
    .from('menus')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return dbError('deleteMenu', error, 'No se pudo eliminar el menú')
  return {}
}

// ─── Sections CRUD ────────────────────────────────────────────────────────────

export async function createMenuSection(
  menuId: string,
  name: string,
  seleccion = true
): Promise<{ id: string } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, restaurantId, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(menuId).success) return { error: 'Datos no válidos' }
  if (!z.string().trim().min(1).max(80).safeParse(name).success) return { error: 'Nombre obligatorio' }

  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('id', menuId)
    .eq('restaurant_id', restaurantId)
    .single()
  if (!menu) return { error: 'Menú no encontrado' }

  const { data: maxRow } = await supabase
    .from('menu_sections')
    .select('sort_order')
    .eq('menu_id', menuId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = (maxRow?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('menu_sections')
    .insert({ menu_id: menuId, name: name.trim(), sort_order, seleccion })
    .select('id')
    .single()

  if (error || !data) return dbError('createMenuSection', error, 'No se pudo crear la sección')
  return { id: data.id }
}

export async function updateMenuSection(id: string, params: { name?: string; seleccion?: boolean }): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(id).success) return { error: 'Datos no válidos' }
  if (params.name !== undefined && !z.string().trim().min(1).max(80).safeParse(params.name).success) return { error: 'Nombre obligatorio' }

  const updateData: Record<string, unknown> = {}
  if (params.name !== undefined) updateData.name = params.name.trim()
  if (params.seleccion !== undefined) updateData.seleccion = params.seleccion

  const { error } = await supabase
    .from('menu_sections')
    .update(updateData)
    .eq('id', id)

  if (error) return dbError('updateMenuSection', error, 'No se pudo actualizar la sección')
  return {}
}

export async function deleteMenuSection(id: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(id).success) return { error: 'Datos no válidos' }

  const { error } = await supabase.from('menu_sections').delete().eq('id', id)
  if (error) return dbError('deleteMenuSection', error, 'No se pudo eliminar la sección')
  return {}
}

export async function reorderMenuSections(
  sections: { id: string; sort_order: number }[]
): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  for (const s of sections) {
    await supabase.from('menu_sections').update({ sort_order: s.sort_order }).eq('id', s.id)
  }
  return {}
}

// ─── Section Items CRUD ───────────────────────────────────────────────────────

export async function addMenuSectionCustomItem(
  sectionId: string,
  customName: string
): Promise<{ id: string } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(sectionId).success) return { error: 'Datos no válidos' }
  const name = customName.trim()
  if (!name) return { error: 'Nombre obligatorio' }

  const { data: maxRow } = await supabase
    .from('menu_section_items')
    .select('sort_order')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = (maxRow?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('menu_section_items')
    .insert({ section_id: sectionId, custom_name: name, sort_order })
    .select('id')
    .single()

  if (error || !data) return dbError('addMenuSectionCustomItem', error, 'No se pudo añadir el plato')
  return { id: data.id }
}

export async function addMenuSectionItem(
  sectionId: string,
  menuItemId: string
): Promise<{ id: string } | { error: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(sectionId).success || !uuid.safeParse(menuItemId).success)
    return { error: 'Datos no válidos' }

  const { data: maxRow } = await supabase
    .from('menu_section_items')
    .select('sort_order')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = (maxRow?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('menu_section_items')
    .insert({ section_id: sectionId, menu_item_id: menuItemId, sort_order })
    .select('id')
    .single()

  if (error || !data) return dbError('addMenuSectionItem', error, 'No se pudo añadir el plato')
  return { id: data.id }
}

export async function removeMenuSectionItem(id: string): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(id).success) return { error: 'Datos no válidos' }

  const { error } = await supabase.from('menu_section_items').delete().eq('id', id)
  if (error) return dbError('removeMenuSectionItem', error, 'No se pudo eliminar el plato')
  return {}
}

export async function toggleMenuSectionItem(
  id: string,
  is_active: boolean
): Promise<{ error?: string }> {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { supabase, userId, isSuperadminMode } = ctx
  if (!isSuperadminMode && !await puedeEditar(supabase, userId)) return { error: 'Sin permisos' }

  if (!uuid.safeParse(id).success) return { error: 'Datos no válidos' }

  const { error } = await supabase
    .from('menu_section_items')
    .update({ is_active })
    .eq('id', id)

  if (error) return dbError('toggleMenuSectionItem', error, 'No se pudo actualizar el plato')
  return {}
}
