import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json()

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Falta el ID de usuario' }, { status: 400 })
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

    if (!callerUser) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    const callerRoles = callerUser.user_roles as { roles: { name: string } | null }[]
    const callerRoleName = callerRoles?.[0]?.roles?.name ?? null

    if (callerRoleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo los administradores pueden desactivar usuarios' }, { status: 403 })
    }

    if (callerUser.id === user_id) {
      return NextResponse.json({ success: false, error: 'No puedes desactivarte a ti mismo' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ activo: false })
      .eq('id', user_id)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
