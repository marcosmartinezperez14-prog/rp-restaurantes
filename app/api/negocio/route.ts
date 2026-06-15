import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'

const RPC_MAP = {
  resumen:   'get_resumen_hoy',
  actividad: 'get_actividad_reciente',
} as const

type TipoNegocio = keyof typeof RPC_MAP

export async function GET(req: NextRequest) {
  const tipo = new URL(req.url).searchParams.get('tipo')

  if (!tipo || !(tipo in RPC_MAP)) {
    return NextResponse.json(
      { error: 'Parámetro tipo requerido: resumen | actividad' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase.rpc(RPC_MAP[tipo as TipoNegocio])

  if (error) return jsonError('No se pudieron cargar los datos', 500, error)

  return NextResponse.json({ data })
}
