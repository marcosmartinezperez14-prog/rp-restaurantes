import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FichajeHistorial } from '@/types/fichajes'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') ?? undefined
  const hasta = searchParams.get('hasta') ?? undefined
  const user_id = searchParams.get('user_id') ?? undefined

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const params: Record<string, string | null> = {}
  if (desde !== undefined) params.p_desde = desde
  if (hasta !== undefined) params.p_hasta = hasta
  params.p_user_id = user_id ?? null

  const { data, error } = await supabase.rpc('get_fichajes_rango', params)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: (data ?? []) as FichajeHistorial[] })
}
