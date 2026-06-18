'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isSuperadmin } from '@/lib/auth/superadmin'

export type TablaPapelera =
  | 'tables'
  | 'zones'
  | 'categories'
  | 'menu_items'
  | 'products'
  | 'users'
  | 'reservations'
  | 'movimientos'
  | 'product_modifier_groups'
  | 'product_modifier_options'
  | 'roles'
  | 'turnos'
  | 'dias_libres'
  | 'solicitudes_vacaciones'

export interface ItemPapelera {
  id: string
  nombre: string
  extra?: string
  restaurante: string
  restaurant_id: string
  deleted_at: string
  deleted_by: string | null
}

export interface DatosPapelera {
  // Fase 1
  mesas:       ItemPapelera[]
  zonas:       ItemPapelera[]
  categorias:  ItemPapelera[]
  platos:      ItemPapelera[]
  productos:   ItemPapelera[]
  usuarios:    ItemPapelera[]
  // Fase 2
  reservas:    ItemPapelera[]
  movimientos: ItemPapelera[]
  // Fase 3
  gruposModificadores:   ItemPapelera[]
  opcionesModificadores: ItemPapelera[]
  // Fase 4
  rolesPersonalizados: ItemPapelera[]
  // Fase 5
  turnos:                ItemPapelera[]
  diasLibres:            ItemPapelera[]
  solicitudesVacaciones: ItemPapelera[]
}

// Alias para compatibilidad con imports existentes de Fase 1
export type TablaFase1 = TablaPapelera
export type PapeleraFase1 = DatosPapelera

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getPapeleraFase1(): Promise<DatosPapelera> {
  const [mesas, zonas, categorias, platos, productos, usuarios, reservas, movimientos, gruposMod, opcionesMod, roles, turnos, diasLibres, solicitudes] =
    await Promise.all([
      getSupabaseAdmin()
        .from('tables')
        .select('id, name, capacity, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('zones')
        .select('id, name, color, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('categories')
        .select('id, name, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('menu_items')
        .select('id, name, price, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('products')
        .select('id, name, cost_price, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('users')
        .select('id, nombre, email, activo, restaurant_id, restaurants(name)')
        .eq('activo', false)
        .order('id', { ascending: false }),

      getSupabaseAdmin()
        .from('reservations')
        .select('id, customer_name, party_size, reservation_date, reservation_time, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('movimientos')
        .select('id, concepto, tipo, importe, fecha, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('product_modifier_groups')
        .select('id, name, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('product_modifier_options')
        .select('id, name, price_delta, deleted_at, deleted_by, product_modifier_groups!inner(restaurant_id, restaurants(name))')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('roles')
        .select('id, name, display_name, deleted_at, deleted_by, restaurant_id, restaurants(name)')
        .not('deleted_at', 'is', null)
        .not('restaurant_id', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('turnos')
        .select('id, fecha, hora_inicio, hora_fin, tipo, deleted_at, deleted_by, restaurant_id, restaurants(name), users!empleado_id(nombre, email)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('dias_libres')
        .select('id, fecha, tipo, deleted_at, deleted_by, restaurant_id, restaurants(name), users!empleado_id(nombre, email)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),

      getSupabaseAdmin()
        .from('solicitudes_vacaciones')
        .select('id, fecha_inicio, fecha_fin, estado, deleted_at, deleted_by, restaurant_id, restaurants(name), users!empleado_id(nombre, email)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
    ])

  function toItem(row: Record<string, unknown>, nombre: string, extra?: string): ItemPapelera {
    const rest = row.restaurants as { name: string } | null
    return {
      id:            row.id as string,
      nombre,
      extra,
      restaurante:   rest?.name ?? '—',
      restaurant_id: row.restaurant_id as string,
      deleted_at:    (row.deleted_at ?? '') as string,
      deleted_by:    (row.deleted_by ?? null) as string | null,
    }
  }

  return {
    mesas: (mesas.data ?? []).map(r =>
      toItem(r as Record<string, unknown>, r.name, `Cap. ${r.capacity}`)),
    zonas: (zonas.data ?? []).map(r =>
      toItem(r as Record<string, unknown>, r.name, r.color)),
    categorias: (categorias.data ?? []).map(r =>
      toItem(r as Record<string, unknown>, r.name)),
    platos: (platos.data ?? []).map(r =>
      toItem(r as Record<string, unknown>, r.name, `${Number(r.price).toFixed(2)}€`)),
    productos: (productos.data ?? []).map(r =>
      toItem(r as Record<string, unknown>, r.name)),
    usuarios: (usuarios.data ?? []).map(r =>
      toItem(
        { ...(r as Record<string, unknown>), deleted_at: '', deleted_by: null },
        (r.nombre as string) || (r.email as string),
        r.email as string,
      )),
    reservas: (reservas.data ?? []).map(r =>
      toItem(
        r as Record<string, unknown>,
        r.customer_name as string,
        `${r.party_size} pers. · ${r.reservation_date} ${r.reservation_time}`,
      )),
    movimientos: (movimientos.data ?? []).map(r =>
      toItem(
        r as Record<string, unknown>,
        r.concepto as string,
        `${r.tipo === 'ingreso' ? '+' : '-'}${Number(r.importe).toFixed(2)}€ · ${r.fecha}`,
      )),
    gruposModificadores: (gruposMod.data ?? []).map(r =>
      toItem(r as Record<string, unknown>, r.name as string)),
    rolesPersonalizados: (roles.data ?? []).map(r =>
      toItem(r as Record<string, unknown>, (r.display_name ?? r.name) as string, r.name as string)),
    opcionesModificadores: (opcionesMod.data ?? []).map(r => {
      const grp = r.product_modifier_groups as unknown as { restaurant_id: string; restaurants: { name: string } | null } | { restaurant_id: string; restaurants: { name: string } | null }[]
      const grpData = Array.isArray(grp) ? grp[0] : grp
      const restName = grpData?.restaurants?.name ?? '—'
      const priceDelta = Number(r.price_delta ?? 0)
      return {
        id:            r.id as string,
        nombre:        r.name as string,
        extra:         priceDelta !== 0 ? `${priceDelta > 0 ? '+' : ''}${priceDelta.toFixed(2)}€` : undefined,
        restaurante:   restName,
        restaurant_id: grpData?.restaurant_id ?? '',
        deleted_at:    (r.deleted_at ?? '') as string,
        deleted_by:    (r.deleted_by ?? null) as string | null,
      }
    }),
    turnos: (turnos.data ?? []).map(r => {
      const empleado = r.users as unknown as { nombre: string | null; email: string | null } | null
      const nombre = empleado?.nombre || empleado?.email || '—'
      return toItem(
        r as Record<string, unknown>,
        nombre,
        `${r.fecha} ${r.hora_inicio}–${r.hora_fin} · ${r.tipo}`,
      )
    }),
    diasLibres: (diasLibres.data ?? []).map(r => {
      const empleado = r.users as unknown as { nombre: string | null; email: string | null } | null
      const nombre = empleado?.nombre || empleado?.email || '—'
      return toItem(r as Record<string, unknown>, nombre, `${r.fecha} · ${r.tipo}`)
    }),
    solicitudesVacaciones: (solicitudes.data ?? []).map(r => {
      const empleado = r.users as unknown as { nombre: string | null; email: string | null } | null
      const nombre = empleado?.nombre || empleado?.email || '—'
      return toItem(
        r as Record<string, unknown>,
        nombre,
        `${r.fecha_inicio} → ${r.fecha_fin} · ${r.estado}`,
      )
    }),
  }
}

// ─── Guard interno ────────────────────────────────────────────────────────────

async function requireSuperadmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ok = await isSuperadmin(supabase, user.id)
  if (!ok) redirect('/dashboard')
  return user.id
}

// ─── Restaurar ────────────────────────────────────────────────────────────────

export async function restaurarItem(
  tabla: TablaPapelera,
  id: string
): Promise<{ error?: string }> {
  await requireSuperadmin()

  if (tabla === 'users') {
    const { error } = await getSupabaseAdmin()
      .from('users')
      .update({ activo: true })
      .eq('id', id)
    if (error) return { error: 'No se pudo restaurar el usuario.' }
    return {}
  }

  const camposReset: Record<string, unknown> = { deleted_at: null, deleted_by: null }
  if (tabla === 'tables' || tabla === 'zones' || tabla === 'product_modifier_groups' || tabla === 'product_modifier_options') {
    camposReset.is_active = true
  }

  const { error } = await getSupabaseAdmin()
    .from(tabla)
    .update(camposReset)
    .eq('id', id)

  if (error) return { error: 'No se pudo restaurar el elemento.' }
  return {}
}

// ─── Eliminar definitivamente ─────────────────────────────────────────────────

export async function eliminarDefinitivo(
  tabla: TablaPapelera,
  id: string
): Promise<{ error?: string }> {
  await requireSuperadmin()

  if (tabla === 'users') {
    const { data: userRow } = await getSupabaseAdmin()
      .from('users')
      .select('id')
      .eq('id', id)
      .single()

    if (!userRow) return { error: 'Usuario no encontrado.' }

    const { error: dbError } = await getSupabaseAdmin()
      .from('users')
      .delete()
      .eq('id', id)
    if (dbError) return { error: 'No se pudo eliminar el usuario.' }

    const { error: authError } = await getSupabaseAdmin().auth.admin.deleteUser(id)
    if (authError) {
      console.error('[eliminarDefinitivo] auth delete error:', authError.message)
    }
    return {}
  }

  const { error } = await getSupabaseAdmin()
    .from(tabla)
    .delete()
    .eq('id', id)

  if (error) return { error: 'No se pudo eliminar el elemento. Puede tener datos asociados.' }
  return {}
}
