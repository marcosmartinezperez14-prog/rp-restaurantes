import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function isSuperadmin(
  _supabase: unknown,
  authUserId: string
): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin()

    const { data: userRow } = await admin
      .from('users')
      .select('id')
      .eq('auth_id', authUserId)
      .single()

    if (!userRow?.id) return false

    const { data: roleRows } = await admin
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userRow.id)

    return (roleRows ?? []).some((r: any) => r.roles?.name === 'superadmin')
  } catch {
    return false
  }
}
