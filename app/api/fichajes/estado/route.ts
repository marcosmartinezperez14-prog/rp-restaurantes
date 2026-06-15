import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'
import type { EstadoFichaje } from '@/types/fichajes'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase.rpc('get_estado_fichaje')
  if (error) return jsonError('No se pudo obtener el estado', 500, error)

  const estado = data as EstadoFichaje
  return NextResponse.json({ data: estado })
}
