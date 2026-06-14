// app/actions/superadmin.ts
'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type SuperadminActionResult =
  | { success: true; restaurante: string; usuario: string }
  | { error: string }

function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]+$/i.test(username)
}

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

  const restaurant_name = ((formData.get('restaurant_name') as string) ?? '').trim()
  const nif = ((formData.get('nif') as string) ?? '').trim()
  const nombre = ((formData.get('nombre') as string) ?? '').trim()
  const username = ((formData.get('username') as string) ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''

  if (!restaurant_name) return { error: 'El nombre del restaurante es obligatorio.' }
  if (!nif) return { error: 'El NIF es obligatorio.' }
  if (!nombre) return { error: 'El nombre del admin es obligatorio.' }
  if (!username) return { error: 'El usuario es obligatorio.' }
  if (!isValidUsername(username)) return { error: 'El usuario solo puede contener letras, números, guiones y guiones bajos.' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }

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
    return { error: authError?.message ?? 'Error al crear el usuario en autenticación.' }
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

  // Actualizar el users record con datos completos (el trigger solo pone id y restaurant_id)
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ auth_id: authUserId, nombre, email })
    .eq('id', authUserId)

  if (updateError) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    return { error: `Error al actualizar el perfil: ${updateError.message}` }
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
    return { error: `Error al asignar el rol: ${userRoleError.message}` }
  }

  return { success: true, restaurante: restaurant_name, usuario: username }
}
