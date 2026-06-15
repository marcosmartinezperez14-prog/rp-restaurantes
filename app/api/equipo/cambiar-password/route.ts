import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const schema = z.object({
  auth_id: z.string().uuid('Datos no válidos'),
  nueva_password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'La contraseña es demasiado larga'),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
    }
    const { auth_id, nueva_password } = parsed.data

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
      console.error('[cambiar-password] error:', error.message)
      return NextResponse.json({ success: false, error: 'No se pudo cambiar la contraseña' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cambiar-password] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Error inesperado' }, { status: 500 })
  }
}
