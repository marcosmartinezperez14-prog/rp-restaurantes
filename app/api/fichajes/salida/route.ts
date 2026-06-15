import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'
import { z } from 'zod'
import type { FichajeAccionResult } from '@/types/fichajes'

const schema = z.object({ nota: z.string().max(500).optional() })

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
  }
  const nota = parsed.data.nota

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase.rpc('fichar_salida', { p_nota: nota ?? null })
  if (error) return jsonError('No se pudo registrar la salida', 500, error)

  const result = data as { ok?: boolean; id?: string; error?: string }
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ data: { ok: true, id: result.id } satisfies FichajeAccionResult })
}
