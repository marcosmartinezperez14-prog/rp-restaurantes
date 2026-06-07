import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ItemCarta = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  imagen_url: string | null
}

export type CategoriaCarta = {
  id: string
  nombre: string
  items: ItemCarta[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data: restaurante } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!restaurante) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  const { data: categorias } = await supabaseAdmin
    .from('categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurante.id)
    .is('deleted_at', null)
    .order('position')

  const { data: items } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, image_url, category_id')
    .eq('restaurant_id', restaurante.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  const carta: CategoriaCarta[] = (categorias ?? []).map(cat => ({
    id: cat.id,
    nombre: cat.name,
    items: (items ?? [])
      .filter(item => item.category_id === cat.id)
      .map(item => ({
        id: item.id,
        nombre: item.name,
        descripcion: item.description ?? null,
        precio: Number(item.price),
        imagen_url: item.image_url ?? null,
      })),
  })).filter(cat => cat.items.length > 0)

  // Items sin categoría al final
  const sinCategoria = (items ?? []).filter(item => !item.category_id)
  if (sinCategoria.length > 0) {
    carta.push({
      id: 'sin-categoria',
      nombre: 'Otros',
      items: sinCategoria.map(item => ({
        id: item.id,
        nombre: item.name,
        descripcion: item.description ?? null,
        precio: Number(item.price),
        imagen_url: item.image_url ?? null,
      })),
    })
  }

  return NextResponse.json({ carta })
}
