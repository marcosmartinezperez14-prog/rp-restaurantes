import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { plantillaLegal } from '@/lib/legal/templates'
import { LEGAL_TITULO, type LegalTipo } from '@/types/legal'
import MarkdownLegal from './MarkdownLegal'

// Server Component compartido por las tres páginas legales públicas.
// Resuelve el restaurante por slug y muestra el texto de legal_pages; si no
// existe, cae en una plantilla por defecto (RGPD España).
export default async function LegalPageView({
  slug,
  tipo,
}: {
  slug: string
  tipo: LegalTipo
}) {
  const { data: restaurante } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!restaurante) notFound()

  const { data: legal } = await supabaseAdmin
    .from('legal_pages')
    .select('contenido, updated_at')
    .eq('restaurant_id', restaurante.id)
    .eq('tipo', tipo)
    .maybeSingle()

  const contenido =
    legal?.contenido?.trim()
      ? legal.contenido
      : plantillaLegal(tipo, restaurante.name)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <a
          href={`/cliente/${slug}`}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Volver"
        >
          ←
        </a>
        <h1 className="text-xl font-bold text-gray-900">{LEGAL_TITULO[tipo]}</h1>
      </div>

      <article>
        <MarkdownLegal contenido={contenido} />
      </article>

      <p className="mt-8 text-xs text-gray-400">{restaurante.name}</p>
    </div>
  )
}
