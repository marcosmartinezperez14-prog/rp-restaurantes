import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { ROLES_PROTEGIDOS } from '@/lib/permisos/modulos'

const postSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(60, 'Máximo 60 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9 _-]+$/, 'Solo letras, números, espacios, guiones y guiones bajos'),
})

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
  return { userId: data.id as string, restaurantId: data.restaurant_id as string, rol }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const caller = await getCaller(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  const nombre = parsed.data.nombre.toLowerCase().replace(/\s+/g, '_')

  if (ROLES_PROTEGIDOS.includes(nombre) || ['gerente', 'camarero', 'cocinero', 'contable', 'superadmin'].includes(nombre)) {
    return NextResponse.json({ error: 'Ese nombre está reservado para roles del sistema' }, { status: 400 })
  }

  // Verificar que no exista ya ese nombre en este restaurante
  const { data: existente } = await getSupabaseAdmin()
    .from('roles')
    .select('id')
    .eq('name', nombre)
    .eq('restaurant_id', caller.restaurantId)
    .maybeSingle()

  if (existente) {
    return NextResponse.json({ error: 'Ya existe un rol con ese nombre en tu restaurante' }, { status: 409 })
  }

  const { data: nuevoRol, error } = await getSupabaseAdmin()
    .from('roles')
    .insert({
      name: nombre,
      display_name: parsed.data.nombre,
      description: `Rol personalizado de ${caller.restaurantId}`,
      restaurant_id: caller.restaurantId,
    })
    .select('id, name, display_name, restaurant_id')
    .single()

  if (error) return jsonError('No se pudo crear el rol', 500, error)
  return NextResponse.json({ data: nuevoRol }, { status: 201 })
}
