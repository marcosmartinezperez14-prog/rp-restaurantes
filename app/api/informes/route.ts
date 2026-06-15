import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/errors'

const RPC_MAP = {
  franja:    'get_ventas_por_franja',
  camarero:  'get_ventas_por_camarero',
  productos: 'get_productos_ranking',
  resumen:   'get_resumen_ventas',
} as const

type TipoInforme = keyof typeof RPC_MAP

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tipo  = searchParams.get('tipo')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (!tipo || !desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros requeridos: tipo, desde, hasta' }, { status: 400 })
  }

  if (!(tipo in RPC_MAP)) {
    return NextResponse.json({ error: `Tipo no válido: ${tipo}` }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const rpcName = RPC_MAP[tipo as TipoInforme]
  const { data, error } = await supabase.rpc(rpcName, { p_desde: desde, p_hasta: hasta })

  if (error) return jsonError('No se pudo generar el informe', 500, error)

  return NextResponse.json({ data })
}
