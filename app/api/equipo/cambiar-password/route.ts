import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { auth_id, nueva_password } = await req.json()

    if (!auth_id || !nueva_password) {
      return NextResponse.json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (nueva_password.length < 8) {
      return NextResponse.json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { data: callerUser } = await supabase
      .from('users')
      .select('id, restaurant_id, user_roles!user_id(roles(name))')
      .eq('auth_id', caller.id)
      .single()

    if (!callerUser) return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })

    const callerRoles = callerUser.user_roles as unknown as { roles: { name: string } | null }[]
    const callerRoleName = callerRoles?.[0]?.roles?.name ?? null

    if (callerRoleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo los administradores pueden cambiar contraseñas de otros usuarios' }, { status: 403 })
    }

    // Verificar que el usuario destino pertenece al mismo restaurante
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, restaurant_id')
      .eq('auth_id', auth_id)
      .single()

    if (!targetUser || targetUser.restaurant_id !== callerUser.restaurant_id) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_id, {
      password: nueva_password,
    })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
