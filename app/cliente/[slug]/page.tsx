import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CategoriaCarta } from '@/app/api/cliente/[slug]/carta/route'
import type { ReservasConfig } from '@/types/administracion'
import { DEFAULT_CONFIG } from '@/types/administracion'
import CartaPublicaClient from '@/components/cliente/CartaPublicaClient'

export default async function ClienteCartaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: restaurante } = await supabase
    .from('restaurants')
    .select('id, name, slug, max_online_comensales')
    .eq('slug', slug)
    .single()

  if (!restaurante) notFound()

  const { data: categorias } = await supabase
    .from('menu_categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurante.id)
    .order('position')

  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, description, price, image_url, menu_category_id')
    .eq('restaurant_id', restaurante.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  const carta: CategoriaCarta[] = (categorias ?? []).map(cat => ({
    id: cat.id,
    nombre: cat.name,
    items: (items ?? [])
      .filter(i => i.menu_category_id === cat.id)
      .map(i => ({
        id: i.id,
        nombre: i.name,
        descripcion: i.description ?? null,
        precio: Number(i.price),
        imagen_url: i.image_url ?? null,
        cantidad_minima: 1,
      })),
  })).filter(cat => cat.items.length > 0)

  const sinCategoria = (items ?? []).filter(i => !i.menu_category_id)
  if (sinCategoria.length > 0) {
    carta.push({
      id: 'sin-categoria',
      nombre: 'Otros',
      items: sinCategoria.map(i => ({
        id: i.id,
        nombre: i.name,
        descripcion: i.description ?? null,
        precio: Number(i.price),
        imagen_url: i.image_url ?? null,
        cantidad_minima: 1,
      })),
    })
  }

  const { data: reservaSettings } = await supabase
    .from('reservation_settings')
    .select('schedule, duration_minutes')
    .eq('restaurant_id', restaurante.id)
    .maybeSingle()

  const reservasConfig: ReservasConfig = reservaSettings
    ? { ...DEFAULT_CONFIG, schedule: reservaSettings.schedule, duration_minutes: reservaSettings.duration_minutes }
    : DEFAULT_CONFIG

  return (
    <CartaPublicaClient
      restaurante={{
        id: restaurante.id,
        name: restaurante.name,
        slug: restaurante.slug,
        max_online_comensales: restaurante.max_online_comensales ?? null,
      }}
      carta={carta}
      reservasConfig={reservasConfig}
    />
  )
}
