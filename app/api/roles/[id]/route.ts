import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { ROLES_NO_ELIMINABLES } from '@/lib/permisos/modulos'

async function getCaller(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('id, restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()
  if (!data) return null
  const rolesData = data.user_roles as unknown as { roles: { name: string } | null }[]
  const rol = rolesData?.[0]?.roles?.name ?? null
  return { restaurantId: data.restaurant_id as string, rol }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const caller = await getCaller(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Verificar que el rol pertenece a ESTE restaurante (aislamiento entre tenants)
  const { data: rol } = await supabaseAdmin
    .from('roles')
    .select('id, name, restaurant_id')
    .eq('id', id)
    .maybeSingle()

  if (!rol) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })

  // Roles protegidos: nunca eliminables
  if (ROLES_NO_ELIMINABLES.includes(rol.name)) {
    return NextResponse.json({ error: `El rol "${rol.name}" no se puede eliminar` }, { status: 403 })
  }

  // Si es un rol personalizado de otro restaurante, rechazar
  if (rol.restaurant_id && rol.restaurant_id !== caller.restaurantId) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Verificar que no haya usuarios asignados a este rol en este restaurante
  const { count } = await supabaseAdmin
    .from('user_roles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', id)
    .eq('restaurant_id', caller.restaurantId)

  if (count && count > 0) {
    return NextResponse.json({
      error: `No se puede eliminar: hay ${count} usuario${count > 1 ? 's' : ''} con este rol. Reasígnalos primero.`
    }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('roles')
    .delete()
    .eq('id', id)

  if (error) return jsonError('No se pudo eliminar el rol', 500, error)
  return NextResponse.json({ ok: true })
}
