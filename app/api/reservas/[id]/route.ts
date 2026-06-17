import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'

const patchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional(),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida').optional(),
  party_size: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(500).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Ningún campo para actualizar' })

async function getCaller(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()
  if (!data) return null
  const rolesData = data.user_roles as unknown as { roles: { name: string } | null }[]
  const rolNames = (rolesData ?? []).map(r => r.roles?.name ?? '')
  const rol = rolNames.find(n => ['admin', 'gerente'].includes(n)) ?? rolNames[0] ?? null
  return { restaurantId: data.restaurant_id as string, rol }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  const supabase = await createClient()
  const caller = await getCaller(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  // Verificar que la reserva pertenece a este restaurante
  const { data: reserva } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', caller.restaurantId)
    .maybeSingle()

  if (!reserva) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  const { data: updated, error } = await supabaseAdmin
    .from('reservations')
    .update(parsed.data)
    .eq('id', id)
    .eq('restaurant_id', caller.restaurantId)
    .select()
    .single()

  if (error) return jsonError('No se pudo actualizar la reserva', 500, error)
  return NextResponse.json({ data: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  const supabase = await createClient()
  const caller = await getCaller(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: reserva } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', caller.restaurantId)
    .maybeSingle()

  if (!reserva) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('reservations')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', caller.restaurantId)

  if (error) return jsonError('No se pudo eliminar la reserva', 500, error)
  return NextResponse.json({ ok: true })
}
