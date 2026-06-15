// app/actions/superadmin.ts
'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
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

  const { data: callerUser } = await supabase
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
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return { error: 'Este nombre de usuario ya está en uso.' }

  // Crear auth user — el trigger handle_new_user crea restaurants + users automáticamente
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
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
  const { data: userRecord, error: userReadError } = await supabaseAdmin
    .from('users')
    .select('restaurant_id')
    .eq('id', authUserId)
    .single()

  if (userReadError || !userRecord?.restaurant_id) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    return { error: 'El trigger no creó el restaurante. Revisa la migración 002.' }
  }

  const restaurantId = userRecord.restaurant_id

  // Guardar el NIF en el restaurante (el trigger solo pone el nombre)
  const { error: restaurantUpdateError } = await supabaseAdmin
    .from('restaurants')
    .update({ nif })
    .eq('id', restaurantId)

  if (restaurantUpdateError) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    console.error('[crearRestauranteConAdmin] nif error:', restaurantUpdateError.message)
    return { error: 'No se pudo crear el restaurante.' }
  }

  // Actualizar el users record con datos completos (el trigger solo pone id y restaurant_id)
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ auth_id: authUserId, nombre, email })
    .eq('id', authUserId)

  if (updateError) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    console.error('[crearRestauranteConAdmin] profile error:', updateError.message)
    return { error: 'No se pudo crear el restaurante.' }
  }

  // Asignar rol admin al nuevo usuario
  const { data: rol, error: rolError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .single()

  if (rolError || !rol) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    return { error: 'Rol "admin" no encontrado en la tabla roles. Ejecuta el SQL del módulo Equipo.' }
  }

  const { error: userRoleError } = await supabaseAdmin
    .from('user_roles')
    .insert({ user_id: authUserId, role_id: rol.id, restaurant_id: restaurantId })

  if (userRoleError) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    console.error('[crearRestauranteConAdmin] role error:', userRoleError.message)
    return { error: 'No se pudo asignar el rol.' }
  }

  return { success: true, restaurante: restaurant_name, usuario: username }
}
