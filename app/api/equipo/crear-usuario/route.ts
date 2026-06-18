import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { PERMISOS_POR_ROL } from '@/types/equipo'
import { z } from 'zod'


const ROLES_VALIDOS = Object.keys(PERMISOS_POR_ROL)

const schema = z.object({
  username: z.string().trim().min(1).max(50).regex(/^[a-z0-9_-]+$/i, 'El usuario solo puede contener letras, números, guiones y guiones bajos'),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'El nombre es demasiado largo'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'La contraseña es demasiado larga'),
  role_name: z.string().refine(r => ROLES_VALIDOS.includes(r), 'Rol no válido'),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
    }
    const { username, nombre, password, role_name } = parsed.data

    const email = `${username.trim().toLowerCase()}@rp-internal.com`

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

    const callerRoles = callerUser.user_roles as unknown as { roles: { name: string } | null }[]
    const callerRoleName = callerRoles?.[0]?.roles?.name ?? null

    if (callerRoleName !== 'admin' && callerRoleName !== 'gerente') {
      return NextResponse.json({ success: false, error: 'No tienes permisos para crear usuarios' }, { status: 403 })
    }

    // Lista blanca de roles + escalada: un gerente no puede crear administradores.
    if (!ROLES_VALIDOS.includes(role_name)) {
      return NextResponse.json({ success: false, error: 'Rol no válido' }, { status: 400 })
    }
    if (callerRoleName === 'gerente' && role_name === 'admin') {
      return NextResponse.json({ success: false, error: 'Un gerente no puede crear administradores' }, { status: 403 })
    }

    const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: username.trim().toLowerCase(), name: nombre },
    })

    if (authError || !authData.user) {
      // Mensaje genérico para no permitir enumeración de usuarios existentes (#10).
      console.error('[crear-usuario] auth error:', authError?.message)
      return NextResponse.json({ success: false, error: 'No se pudo crear el usuario' }, { status: 400 })
    }

    const { data: newUser, error: userError } = await getSupabaseAdmin()
      .from('users')
      .insert({ id: authData.user.id, auth_id: authData.user.id, nombre, email, restaurant_id: callerUser.restaurant_id })
      .select()
      .single()

    if (userError || !newUser) {
      await getSupabaseAdmin().auth.admin.deleteUser(authData.user.id)
      console.error('[crear-usuario] profile error:', userError?.message)
      return NextResponse.json({ success: false, error: 'No se pudo crear el perfil de usuario' }, { status: 500 })
    }

    const { data: rol, error: rolError } = await getSupabaseAdmin()
      .from('roles')
      .select('id')
      .eq('name', role_name)
      .single()

    if (rolError || !rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    const { error: userRoleError } = await getSupabaseAdmin()
      .from('user_roles')
      .insert({ user_id: newUser.id, role_id: rol.id, restaurant_id: callerUser.restaurant_id })

    if (userRoleError) {
      console.error('[crear-usuario] role error:', userRoleError.message)
      return NextResponse.json({ success: false, error: 'No se pudo asignar el rol' }, { status: 500 })
    }

    return NextResponse.json({ success: true, usuario: { ...newUser, rol: role_name } })
  } catch (err) {
    console.error('[crear-usuario] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Error inesperado' }, { status: 500 })
  }
}
