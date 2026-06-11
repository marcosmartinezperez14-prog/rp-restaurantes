import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FichajeAccionResult } from '@/types/fichajes'

export async function POST(req: NextRequest) {
  let nota: string | undefined
  try {
    const body = await req.json()
    nota = typeof body?.nota === 'string' ? body.nota : undefined
  } catch {
    // no body or invalid JSON — ok, nota stays undefined
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase.rpc('fichar_salida', { p_nota: nota ?? null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = data as { ok?: boolean; id?: string; error?: string }
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ data: { ok: true, id: result.id } satisfies FichajeAccionResult })
}
