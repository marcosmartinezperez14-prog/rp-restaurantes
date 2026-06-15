import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { PERMISOS_POR_ROL } from '@/types/equipo'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ROLES_VALIDOS = Object.keys(PERMISOS_POR_ROL)

export async function POST(req: NextRequest) {
  try {
    const { user_role_id, nuevo_rol } = await req.json()

    if (!user_role_id || !nuevo_rol) {
      return NextResponse.json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    // Lista blanca: solo se pueden asignar roles válidos del sistema.
    if (!ROLES_VALIDOS.includes(nuevo_rol)) {
      return NextResponse.json({ success: false, error: 'Rol no válido' }, { status: 400 })
    }

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
    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('id, restaurant_id')
      .eq('id', user_role_id)
      .single()

    if (!targetRole || targetRole.restaurant_id !== callerUser.restaurant_id) {
      return NextResponse.json({ success: false, error: 'Asignación no encontrada' }, { status: 404 })
    }

    const { data: rol, error: rolError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', nuevo_rol)
      .single()

    if (rolError || !rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_roles')
      .update({ role_id: rol.id })
      .eq('id', user_role_id)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
