import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ restaurante: data })
}
