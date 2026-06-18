'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type AuthState = { error?: string; success?: boolean } | undefined

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@rp-internal.com`
}

const loginSchema = z.object({
  username: z.string().trim().min(1, 'El campo usuario es obligatorio.').max(160),
  password: z.string().min(1, 'El campo contraseña es obligatorio.').max(72),
})

const registerSchema = z.object({
  restaurant_name: z.string().trim().min(1, 'El nombre del restaurante es obligatorio.').max(160),
  nif: z.string().trim().min(1, 'El NIF es obligatorio.').max(20),
  name: z.string().trim().min(1, 'Tu nombre es obligatorio.').max(120),
  username: z.string().trim().min(1, 'El campo usuario es obligatorio.').max(50)
    .regex(/^[a-z0-9_-]+$/i, 'El usuario solo puede contener letras, números, guiones y guiones bajos.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').max(72),
})

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username') ?? '',
    password: formData.get('password') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  const { username, password } = parsed.data

  // Si contiene @ se trata como email real; si no, se mapea al dominio interno
  const email = username.trim().includes('@')
    ? username.trim()
    : usernameToEmail(username)

  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Credenciales incorrectas. Verifica tu usuario y contraseña.' }
  }

  // Comprobar si es superadmin para redirigir al panel correcto
  const { data: userRecord } = await supabase
    .from('users')
    .select('id, user_roles!user_id(roles(name))')
    .eq('auth_id', authData.user.id)
    .single()

  const roles = userRecord?.user_roles as { roles: { name: string } | null }[] | undefined
  const isSuperadmin = roles?.some(r => r.roles?.name === 'superadmin') ?? false

  redirect(isSuperadmin ? '/superadmin' : '/dashboard')
}

export async function registerAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    restaurant_name: formData.get('restaurant_name') ?? '',
    nif: formData.get('nif') ?? '',
    name: formData.get('name') ?? '',
    username: formData.get('username') ?? '',
    password: formData.get('password') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  const { restaurant_name, nif, name, username, password } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: {
      data: {
        username: username.trim().toLowerCase(),
        restaurant_name: restaurant_name.trim(),
        nif: nif.trim(),
        name: name.trim(),
      },
    },
  })

  if (error) {
    console.error('ERROR SUPABASE SIGNUP:', error.message, error.status)
    const msg = error.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return { error: 'Este usuario ya está registrado. Prueba a iniciar sesión.' }
    }
    return { error: 'Ha ocurrido un error inesperado. Inténtalo de nuevo.' }
  }

  return { success: true }
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
