import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { user_role_id, nuevo_rol } = await req.json()

    if (!user_role_id || !nuevo_rol) {
      return NextResponse.json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { data: callerUser } = await supabase
      .from('users')
      .select('id, user_roles!user_id(roles(name))')
      .eq('auth_id', caller.id)
      .single()

    const callerRoles = callerUser?.user_roles as unknown as { roles: { name: string } | null }[]
    const callerRoleName = callerRoles?.[0]?.roles?.name ?? null

    if (callerRoleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo los administradores pueden cambiar roles' }, { status: 403 })
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
