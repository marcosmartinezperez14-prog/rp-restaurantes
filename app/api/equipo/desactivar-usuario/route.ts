import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'


const schema = z.object({ user_id: z.string().uuid('Datos no válidos') })

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
    }
    const { user_id } = parsed.data

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

    if (callerRoleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo los administradores pueden desactivar usuarios' }, { status: 403 })
    }

    if (callerUser.id === user_id) {
      return NextResponse.json({ success: false, error: 'No puedes desactivarte a ti mismo' }, { status: 400 })
    }

    // Ownership: el usuario destino debe pertenecer al mismo restaurante
    // (update con service_role salta RLS).
    const { data: targetUser } = await getSupabaseAdmin()
      .from('users')
      .select('id, restaurant_id')
      .eq('id', user_id)
      .single()

    if (!targetUser || targetUser.restaurant_id !== callerUser.restaurant_id) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { error: updateError } = await getSupabaseAdmin()
      .from('users')
      .update({ activo: false })
      .eq('id', user_id)

    if (updateError) {
      console.error('[desactivar-usuario] error:', updateError.message)
      return NextResponse.json({ success: false, error: 'No se pudo desactivar el usuario' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[desactivar-usuario] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Error inesperado' }, { status: 500 })
  }
}
