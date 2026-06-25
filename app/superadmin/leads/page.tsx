import { getSupabaseAdmin } from '@/lib/supabase/admin'

export default async function LeadsPage() {
  const { data: leads, error } = await getSupabaseAdmin()
    .from('leads_contacto')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="px-6 py-8 text-center text-red-600 text-sm">
        Error cargando leads: {error.message}
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Leads de contacto</h1>
        <span className="text-sm text-[var(--text-secondary)]">{leads.length} total</span>
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)] text-sm">
          No hay leads todavía.
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Nombre</th>
                <th className="text-left px-5 py-3 font-semibold">Restaurante</th>
                <th className="text-left px-5 py-3 font-semibold">Email</th>
                <th className="text-left px-5 py-3 font-semibold">Teléfono</th>
                <th className="text-left px-5 py-3 font-semibold">Mensaje</th>
                <th className="text-left px-5 py-3 font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead: any, i: number) => (
                <tr
                  key={lead.id}
                  className={i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-page)]'}
                >
                  <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{lead.nombre}</td>
                  <td className="px-5 py-3 text-[var(--text-secondary)]">{lead.nombre_restaurante}</td>
                  <td className="px-5 py-3">
                    <a href={`mailto:${lead.email}`} className="text-[var(--accent)] hover:underline">
                      {lead.email}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-[var(--text-secondary)]">{lead.telefono}</td>
                  <td className="px-5 py-3 text-[var(--text-secondary)] max-w-xs truncate">{lead.mensaje ?? '—'}</td>
                  <td className="px-5 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
