import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { CategoriaCarta } from '@/app/api/cliente/[slug]/carta/route'
import CartaGate from '@/components/cliente/CartaGate'

export default async function ClienteCartaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: restaurante } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, name, slug, max_online_comensales')
    .eq('slug', slug)
    .single()

  if (!restaurante) notFound()

  const { data: categorias } = await getSupabaseAdmin()
    .from('menu_categories')
    .select('id, name, position')
    .eq('restaurant_id', restaurante.id)
    .order('position')

  const { data: items } = await getSupabaseAdmin()
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

  // Items sin categoría al final
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Cabecera restaurante */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{restaurante.name}</h1>
      </div>

      <CartaGate maxOnlineComensales={restaurante.max_online_comensales ?? null}>
        {/* Botón reservar */}
        <div className="mb-8">
          <Link
            href={`/cliente/${slug}/reservas`}
            className="block w-full py-3 bg-blue-600 text-white text-center font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Reservar mesa
          </Link>
        </div>

        {/* Carta por categorías */}
        {carta.length === 0 ? (
          <p className="text-center text-gray-500 py-12">La carta no está disponible en este momento.</p>
        ) : (
          <div className="space-y-8">
            {carta.map(categoria => (
              <section key={categoria.id}>
                <h2 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b border-gray-200">
                  {categoria.nombre}
                </h2>
                <div className="space-y-3">
                  {categoria.items.map(item => (
                    <div key={item.id} className="flex gap-3 py-3">
                      {item.imagen_url && (
                        <img
                          src={item.imagen_url}
                          alt={item.nombre}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900 text-sm">{item.nombre}</p>
                          <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                            {item.precio.toFixed(2)} €
                          </p>
                        </div>
                        {item.descripcion && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </CartaGate>
    </div>
  )
}
