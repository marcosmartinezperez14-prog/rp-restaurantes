'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AuthState = { error?: string; success?: boolean } | undefined

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get('email') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''

  if (!email.trim()) return { error: 'El campo email es obligatorio.' }
  if (!isValidEmail(email.trim())) return { error: 'Introduce un email válido.' }
  if (!password) return { error: 'El campo contraseña es obligatorio.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }
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
  const email = (formData.get('email') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''

  if (!restaurant_name.trim()) return { error: 'El nombre del restaurante es obligatorio.' }
  if (!nif.trim()) return { error: 'El NIF es obligatorio.' }
  if (!name.trim()) return { error: 'Tu nombre es obligatorio.' }
  if (!email.trim()) return { error: 'El campo email es obligatorio.' }
  if (!isValidEmail(email.trim())) return { error: 'Introduce un email válido.' }
  if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
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
      return { error: 'Este email ya está registrado. Prueba a iniciar sesión.' }
    }
    return { error: error.message }
  }

  return { success: true }
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
