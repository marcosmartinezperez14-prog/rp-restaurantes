import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import type { ModifierGroup } from '@/types/modificadores'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ menu_item_id: string }> }
) {
  const { menu_item_id } = await params

  const { data: groups, error } = await supabaseAdmin
    .from('product_modifier_groups')
    .select('*, options:product_modifier_options(*)')
    .eq('menu_item_id', menu_item_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order')

  if (error) return jsonError('No se pudieron cargar los modificadores', 500, error)

  const sorted = (groups ?? []).map(g => ({
    ...g,
    options: (g.options as ModifierGroup['options'])
      .filter(o => o.is_active && !o.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order),
  }))

  return NextResponse.json({ data: sorted })
}
