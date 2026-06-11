import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RespuestaMios } from '@/types/permisos'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const [{ data: userData }, { data: rows, error }] = await Promise.all([
    supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', user.id)
      .single(),
    supabase.rpc('get_permisos_usuario_actual'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rolesData = userData?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = rolesData?.[0]?.roles?.name ?? null

  const permisos: Record<string, boolean> = {}
  for (const row of (rows ?? [])) {
    permisos[row.modulo_key] = row.activo
  }

  // Admin siempre tiene acceso a todo
  if (rol === 'admin') {
    for (const key of Object.keys(permisos)) {
      permisos[key] = true
    }
  }

  const respuesta: RespuestaMios = { rol, permisos }
  return NextResponse.json(respuesta)
}
