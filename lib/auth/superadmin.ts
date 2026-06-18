import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Devuelve true si el usuario autenticado tiene el rol superadmin.
 * Úsalo en Server Actions y Route Handlers con el cliente de sesión (createClient()).
 */
export async function isSuperadmin(
  supabase: SupabaseClient,
  authUserId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('user_roles!user_id(roles(name))')
    .eq('id', authUserId)
    .single()

  const roles = data?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  return roles?.some(r => r.roles?.name === 'superadmin') ?? false
}
