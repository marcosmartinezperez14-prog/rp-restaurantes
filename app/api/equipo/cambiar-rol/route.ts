import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { PERMISOS_POR_ROL } from '@/types/equipo'
import { z } from 'zod'


const ROLES_VALIDOS = Object.keys(PERMISOS_POR_ROL)

const schema = z.object({
  user_role_id: z.string().uuid('Datos no válidos'),
  // Lista blanca: solo se pueden asignar roles válidos del sistema.
  nuevo_rol: z.string().refine(r => ROLES_VALIDOS.includes(r), 'Rol no válido'),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
    }
    const { user_role_id, nuevo_rol } = parsed.data

    const supabase = await createServerClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { data: callerUser } = await supabase
      .from('users')
      .select('id, restaurant_id, user_roles!user_id(roles(name))')
      .eq('auth_id', caller.id)
      .single()

    const callerRoles = callerUser?.user_roles as unknown as { roles: { name: string } | null }[]
    const callerRoleName = callerRoles?.[0]?.roles?.name ?? null

    if (callerRoleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo los administradores pueden cambiar roles' }, { status: 403 })
    }

    if (!callerUser?.restaurant_id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Ownership: el user_role destino debe pertenecer al mismo restaurante (la
    // RPC/update usa service_role y salta RLS, así que validamos aquí).
    const { data: targetRole } = await getSupabaseAdmin()
      .from('user_roles')
      .select('id, restaurant_id')
      .eq('id', user_role_id)
      .single()

    if (!targetRole || targetRole.restaurant_id !== callerUser.restaurant_id) {
      return NextResponse.json({ success: false, error: 'Asignación no encontrada' }, { status: 404 })
    }

    const { data: rol, error: rolError } = await getSupabaseAdmin()
      .from('roles')
      .select('id')
      .eq('name', nuevo_rol)
      .single()

    if (rolError || !rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    const { error: updateError } = await getSupabaseAdmin()
      .from('user_roles')
      .update({ role_id: rol.id })
      .eq('id', user_role_id)

    if (updateError) {
      console.error('[cambiar-rol] update error:', updateError.message)
      return NextResponse.json({ success: false, error: 'No se pudo cambiar el rol' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cambiar-rol] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Error inesperado' }, { status: 500 })
  }
}
