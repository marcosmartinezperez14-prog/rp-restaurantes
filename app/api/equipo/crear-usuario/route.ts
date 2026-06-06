import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, nombre, password, role_name } = await req.json()

    if (!email || !nombre || !password || !role_name) {
      return NextResponse.json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
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

    if (!callerUser?.restaurant_id) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    const callerRoles = callerUser.user_roles as { roles: { name: string } | null }[]
    const callerRoleName = callerRoles?.[0]?.roles?.name ?? null

    if (callerRoleName !== 'admin' && callerRoleName !== 'gerente') {
      return NextResponse.json({ success: false, error: 'No tienes permisos para crear usuarios' }, { status: 403 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: nombre },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: authError?.message ?? 'Error al crear el usuario en autenticación' }, { status: 500 })
    }

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({ id: authData.user.id, auth_id: authData.user.id, nombre, email, restaurant_id: callerUser.restaurant_id })
      .select()
      .single()

    if (userError || !newUser) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ success: false, error: userError?.message ?? 'Error al crear el perfil de usuario' }, { status: 500 })
    }

    const { data: rol, error: rolError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', role_name)
      .single()

    if (rolError || !rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUser.id, role_id: rol.id, restaurant_id: callerUser.restaurant_id })

    if (userRoleError) {
      return NextResponse.json({ success: false, error: userRoleError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, usuario: { ...newUser, rol: role_name } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
