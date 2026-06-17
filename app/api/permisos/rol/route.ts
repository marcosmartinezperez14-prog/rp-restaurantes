import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { MatrizPermisos } from '@/types/permisos'
import { MODULOS_SISTEMA, MODULOS_SIEMPRE_ACTIVOS, ROLES_PROTEGIDOS, SOLO_ADMIN_PUEDE_CONFIGURAR, ROLES_OCULTOS } from '@/lib/permisos/modulos'
import { jsonError } from '@/lib/api/errors'
import { z } from 'zod'

const postSchema = z.object({
  role_id: z.string().uuid('Datos inválidos'),
  modulo_key: z.string().min(1, 'Datos inválidos').max(100),
  activo: z.boolean({ message: 'Datos inválidos' }),
})

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

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from('roles')
    .select('id, name, restaurant_id')
    .or(`restaurant_id.is.null,restaurant_id.eq.${caller.restaurantId}`)
    .order('name')

  if (rolesError) return jsonError('No se pudieron cargar los roles', 500, rolesError)

  const { data: permisos, error: permisosError } = await supabaseAdmin
    .from('permisos_rol')
    .select('role_id, modulo_key, activo')
    .eq('restaurant_id', caller.restaurantId)

  if (permisosError) return jsonError('No se pudieron cargar los permisos', 500, permisosError)

  const permisosMap = new Map<string, boolean>()
  for (const p of (permisos ?? [])) {
    permisosMap.set(`${p.role_id}:${p.modulo_key}`, p.activo)
  }

  const modulosProtegibles = MODULOS_SISTEMA.filter(m => m.protegible)

  const matriz: MatrizPermisos[] = (roles ?? []).filter(role => !ROLES_OCULTOS.includes(role.name)).map(role => {
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
    return {
      role_id: role.id,
      role_name: role.name,
      restaurant_id: (role as { restaurant_id: string | null }).restaurant_id,
      permisos: permisosPorModulo,
    }
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

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const { role_id, modulo_key, activo } = parsed.data

  const esModuloProtegible = MODULOS_SISTEMA.some(m => m.key === modulo_key && m.protegible)
  if (!esModuloProtegible) {
    return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 })
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

  if (error) return jsonError('No se pudo guardar el permiso', 500, error)
  return NextResponse.json({ ok: true })
}
