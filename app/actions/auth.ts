'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AuthState = { error?: string; success?: boolean } | undefined

function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]+$/i.test(username)
}

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@rp-internal.com`
}

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const username = (formData.get('username') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''

  if (!username.trim()) return { error: 'El campo usuario es obligatorio.' }
  if (!password) return { error: 'El campo contraseña es obligatorio.' }

  // Si contiene @ se trata como email real; si no, se mapea al dominio interno
  const email = username.trim().includes('@')
    ? username.trim()
    : usernameToEmail(username)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Credenciales incorrectas. Verifica tu usuario y contraseña.' }
  }

  redirect('/dashboard')
}

export async function registerAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const restaurant_name = (formData.get('restaurant_name') as string) ?? ''
  const nif = (formData.get('nif') as string) ?? ''
  const name = (formData.get('name') as string) ?? ''
  const username = (formData.get('username') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''

  if (!restaurant_name.trim()) return { error: 'El nombre del restaurante es obligatorio.' }
  if (!nif.trim()) return { error: 'El NIF es obligatorio.' }
  if (!name.trim()) return { error: 'Tu nombre es obligatorio.' }
  if (!username.trim()) return { error: 'El campo usuario es obligatorio.' }
  if (!isValidUsername(username.trim())) return { error: 'El usuario solo puede contener letras, números, guiones y guiones bajos.' }
  if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }

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
