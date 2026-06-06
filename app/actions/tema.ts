'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const TEMAS_VALIDOS = [
  'slate-light', 'slate-dark',
  'ocean-light', 'ocean-dark',
  'sunset-light', 'sunset-dark',
]

export async function guardarTema(tema: string): Promise<{ error?: string }> {
  if (!TEMAS_VALIDOS.includes(tema)) return { error: 'Tema no válido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('users')
    .update({ theme: tema })
    .eq('auth_id', user.id)

  if (error) return { error: error.message }

  return {}
}
