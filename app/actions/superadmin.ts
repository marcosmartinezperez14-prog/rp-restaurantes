// app/actions/superadmin.ts
'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { SA_COOKIE } from '@/lib/auth/restaurant-context'
import { z } from 'zod'

export type SuperadminActionResult =
  | { success: true; restaurante: string; usuario: string }
  | { error: string }

const schema = z.object({
  restaurant_name: z.string().trim().min(1, 'El nombre del restaurante es obligatorio.').max(160),
  nif: z.string().trim().min(1, 'El NIF es obligatorio.').max(20),
  nombre: z.string().trim().min(1, 'El nombre del admin es obligatorio.').max(120),
  username: z.string().trim().toLowerCase().min(1, 'El usuario es obligatorio.').max(50)
    .regex(/^[a-z0-9_-]+$/i, 'El usuario solo puede contener letras, números, guiones y guiones bajos.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(72),
})

export async function crearRestauranteConAdmin(
  _prevState: SuperadminActionResult | undefined,
  formData: FormData
): Promise<SuperadminActionResult> {
  // Verificar que el caller tiene rol superadmin
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { error: 'No autenticado.' }

  const admin = getSupabaseAdmin()
  const { data: callerUser } = await admin
    .from('users')
    .select('id, user_roles!user_id(roles(name))')
    .eq('auth_id', caller.id)
    .single()

  const callerRoles = callerUser?.user_roles as unknown as { roles: { name: string } | null }[]
  const isSuperadmin = callerRoles?.some(r => r.roles?.name === 'superadmin') ?? false

  if (!isSuperadmin) return { error: 'No tienes permisos para realizar esta acción.' }

  const parsed = schema.safeParse({
    restaurant_name: formData.get('restaurant_name') ?? '',
    nif: formData.get('nif') ?? '',
    nombre: formData.get('nombre') ?? '',
    username: formData.get('username') ?? '',
    password: formData.get('password') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  const { restaurant_name, nif, nombre, username, password } = parsed.data

  const email = `${username}@rp-internal.com`

  // Verificar que el username no existe ya
  const { data: existing } = await getSupabaseAdmin()
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return { error: 'Este nombre de usuario ya está en uso.' }

  // Crear auth user — el trigger handle_new_user crea restaurants + users automáticamente
  const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { restaurant_name, username, name: nombre, nif },
  })

  if (authError || !authData.user) {
    console.error('[crearRestauranteConAdmin] auth error:', authError?.message)
    return { error: 'No se pudo crear el usuario.' }
  }

  const authUserId = authData.user.id

  // Leer restaurant_id que creó el trigger
  const { data: userRecord, error: userReadError } = await getSupabaseAdmin()
    .from('users')
    .select('restaurant_id')
    .eq('id', authUserId)
    .single()

  if (userReadError || !userRecord?.restaurant_id) {
    await getSupabaseAdmin().auth.admin.deleteUser(authUserId)
    return { error: 'El trigger no creó el restaurante. Revisa la migración 002.' }
  }

  const restaurantId = userRecord.restaurant_id

  // Guardar el NIF en el restaurante (el trigger solo pone el nombre)
  const { error: restaurantUpdateError } = await getSupabaseAdmin()
    .from('restaurants')
    .update({ nif })
    .eq('id', restaurantId)

  if (restaurantUpdateError) {
    await getSupabaseAdmin().auth.admin.deleteUser(authUserId)
    console.error('[crearRestauranteConAdmin] nif error:', restaurantUpdateError.message)
    return { error: 'No se pudo crear el restaurante.' }
  }

  // Actualizar el users record con datos completos (el trigger solo pone id y restaurant_id)
  const { error: updateError } = await getSupabaseAdmin()
    .from('users')
    .update({ auth_id: authUserId, nombre, email })
    .eq('id', authUserId)

  if (updateError) {
    await getSupabaseAdmin().auth.admin.deleteUser(authUserId)
    console.error('[crearRestauranteConAdmin] profile error:', updateError.message)
    return { error: 'No se pudo crear el restaurante.' }
  }

  // Asignar rol admin al nuevo usuario
  const { data: rol, error: rolError } = await getSupabaseAdmin()
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .single()

  if (rolError || !rol) {
    await getSupabaseAdmin().auth.admin.deleteUser(authUserId)
    return { error: 'Rol "admin" no encontrado en la tabla roles. Ejecuta el SQL del módulo Equipo.' }
  }

  const { error: userRoleError } = await getSupabaseAdmin()
    .from('user_roles')
    .insert({ user_id: authUserId, role_id: rol.id, restaurant_id: restaurantId })

  if (userRoleError) {
    await getSupabaseAdmin().auth.admin.deleteUser(authUserId)
    console.error('[crearRestauranteConAdmin] role error:', userRoleError.message)
    return { error: 'No se pudo asignar el rol.' }
  }

  return { success: true, restaurante: restaurant_name, usuario: username }
}

export interface RestauranteResumen {
  id: string
  name: string
  nif: string | null
  created_at: string
  admin_nombre: string | null
  admin_email: string | null
  num_usuarios: number
  num_mesas: number
}

export async function getRestaurantes(): Promise<RestauranteResumen[] | { error: string }> {
  try {
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { error: 'No autenticado.' }

  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch (e) {
    console.error('[getRestaurantes] admin client error:', e)
    return { error: 'Configuración de servidor incompleta (service key).' }
  }

  const { data: callerUser } = await admin
    .from('users')
    .select('id')
    .eq('auth_id', caller.id)
    .single()
  if (!callerUser) return { error: `Usuario no encontrado en tabla users (auth_id=${caller.id}).` }

  const { data: roleRows } = await admin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', callerUser.id)
  const esSuperadmin = (roleRows ?? []).some((r: any) => r.roles?.name === 'superadmin')
  if (!esSuperadmin) return { error: `Sin rol superadmin (roles encontrados: ${JSON.stringify(roleRows)}).` }

  const { data: restaurants, error: restError } = await admin
    .from('restaurants')
    .select('id, name, nif, created_at')
    .order('created_at', { ascending: false })
  if (restError || !restaurants) return { error: 'Error al obtener restaurantes.' }

  const { data: users } = await admin
    .from('users')
    .select('restaurant_id')
    .is('deleted_at', null)

  const { data: tables } = await admin
    .from('tables')
    .select('restaurant_id')
    .is('deleted_at', null)

  const { data: adminRoleRow } = await admin
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .single()

  const { data: adminUserRoles } = adminRoleRow
    ? await admin
        .from('user_roles')
        .select('restaurant_id, users!user_id(nombre, email)')
        .eq('role_id', adminRoleRow.id)
    : { data: null }

  const usersByRestaurant = new Map<string, number>()
  for (const u of users ?? []) {
    if (u.restaurant_id)
      usersByRestaurant.set(u.restaurant_id, (usersByRestaurant.get(u.restaurant_id) ?? 0) + 1)
  }

  const tablesByRestaurant = new Map<string, number>()
  for (const t of tables ?? []) {
    if (t.restaurant_id)
      tablesByRestaurant.set(t.restaurant_id, (tablesByRestaurant.get(t.restaurant_id) ?? 0) + 1)
  }

  const adminByRestaurant = new Map<string, { nombre: string | null; email: string | null }>()
  for (const ur of (adminUserRoles ?? []) as any[]) {
    if (!adminByRestaurant.has(ur.restaurant_id)) {
      adminByRestaurant.set(ur.restaurant_id, {
        nombre: ur.users?.nombre ?? null,
        email: ur.users?.email ?? null,
      })
    }
  }

  return restaurants.map(r => ({
    id: r.id,
    name: r.name,
    nif: r.nif ?? null,
    created_at: r.created_at,
    admin_nombre: adminByRestaurant.get(r.id)?.nombre ?? null,
    admin_email: adminByRestaurant.get(r.id)?.email ?? null,
    num_usuarios: usersByRestaurant.get(r.id) ?? 0,
    num_mesas: tablesByRestaurant.get(r.id) ?? 0,
  }))
  } catch (e) {
    console.error('[getRestaurantes] unexpected error:', e)
    return { error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function iniciarSesionRemota(restaurantId: string): Promise<never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getSupabaseAdmin()
  const { data: callerUser } = await admin
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  if (!callerUser) redirect('/login')

  const { data: roleRows } = await admin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', callerUser.id)
  const esSuperadmin = (roleRows ?? []).some((r: any) => r.roles?.name === 'superadmin')
  if (!esSuperadmin) redirect('/superadmin')

  const cookieStore = await cookies()
  cookieStore.set(SA_COOKIE, restaurantId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  redirect('/dashboard')
}

export async function cerrarSesionRemota(): Promise<never> {
  const cookieStore = await cookies()
  cookieStore.delete(SA_COOKIE)
  redirect('/superadmin')
}
