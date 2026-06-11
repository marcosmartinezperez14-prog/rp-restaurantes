import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { MatrizPermisos } from '@/types/permisos'
import { MODULOS_SISTEMA, MODULOS_SIEMPRE_ACTIVOS, ROLES_PROTEGIDOS, SOLO_ADMIN_PUEDE_CONFIGURAR } from '@/lib/permisos/modulos'

async function getCallerInfo(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('id, restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!userData) return null
  const rolesData = userData.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = rolesData?.[0]?.roles?.name ?? null
  return { userId: userData.id as string, restaurantId: userData.restaurant_id as string, rol }
}

export async function GET() {
  const supabase = await createClient()
  const caller = await getCallerInfo(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: roles } = await supabaseAdmin
    .from('roles')
    .select('id, name')
    .order('name')

  const { data: permisos } = await supabaseAdmin
    .from('permisos_rol')
    .select('role_id, modulo_key, activo')
    .eq('restaurant_id', caller.restaurantId)

  const permisosMap = new Map<string, boolean>()
  for (const p of (permisos ?? [])) {
    permisosMap.set(`${p.role_id}:${p.modulo_key}`, p.activo)
  }

  const modulosProtegibles = MODULOS_SISTEMA.filter(m => m.protegible)

  const matriz: MatrizPermisos[] = (roles ?? []).map(role => {
    const permisosPorModulo: Record<string, boolean> = {}
    for (const modulo of modulosProtegibles) {
      const key = `${role.id}:${modulo.key}`
      permisosPorModulo[modulo.key] = permisosMap.get(key) ?? true
    }
    if (role.name === 'admin') {
      for (const modulo of modulosProtegibles) {
        permisosPorModulo[modulo.key] = true
      }
    }
    return { role_id: role.id, role_name: role.name, permisos: permisosPorModulo }
  })

  return NextResponse.json({ data: matriz })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const caller = await getCallerInfo(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as { role_id: string; modulo_key: string; activo: boolean }
  const { role_id, modulo_key, activo } = body

  if (!role_id || !modulo_key || typeof activo !== 'boolean') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { data: roleData } = await supabaseAdmin
    .from('roles')
    .select('name')
    .eq('id', role_id)
    .single()

  if (!roleData) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })

  if (ROLES_PROTEGIDOS.includes(roleData.name)) {
    return NextResponse.json({ error: 'El rol admin no es configurable' }, { status: 403 })
  }
  if (caller.rol === 'gerente' && SOLO_ADMIN_PUEDE_CONFIGURAR.includes(roleData.name)) {
    return NextResponse.json({ error: 'Solo admin puede configurar permisos del gerente' }, { status: 403 })
  }
  if (MODULOS_SIEMPRE_ACTIVOS.includes(modulo_key)) {
    return NextResponse.json({ error: 'Este módulo no se puede desactivar' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('permisos_rol')
    .upsert({
      restaurant_id: caller.restaurantId,
      role_id,
      modulo_key,
      activo,
      updated_by: caller.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'restaurant_id,role_id,modulo_key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
