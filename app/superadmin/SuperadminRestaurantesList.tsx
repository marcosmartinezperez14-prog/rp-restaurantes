'use client'

import type { RestauranteResumen } from '@/app/actions/superadmin'
import { iniciarSesionRemota } from '@/app/actions/superadmin'

interface Props {
  datos: RestauranteResumen[]
}

export default function SuperadminRestaurantesList({ datos }: Props) {
  if (datos.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-2xl max-w-2xl mx-auto mt-10">
        <p className="text-3xl mb-3">🍽️</p>
        <p className="text-sm">No hay restaurantes creados todavía.</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Restaurantes</h1>
        <span className="text-xs font-medium bg-[var(--bg-page)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-1 rounded-full">
          {datos.length} {datos.length === 1 ? 'restaurante' : 'restaurantes'}
        </span>
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-page)] border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Restaurante
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                NIF
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Admin
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Usuarios
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Mesas
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Alta
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {datos.map(r => (
              <tr key={r.id} className="bg-[var(--bg-surface)] hover:bg-[var(--bg-page)] transition-colors">
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{r.name}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{r.nif ?? '—'}</td>
                <td className="px-4 py-3">
                  {r.admin_nombre ? (
                    <span className="text-[var(--text-primary)]">{r.admin_nombre}</span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{r.num_usuarios}</td>
                <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{r.num_mesas}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
                  {new Date(r.created_at).toLocaleDateString('es-ES', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={iniciarSesionRemota.bind(null, r.id)}>
                    <button
                      type="submit"
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
                    >
                      Acceder
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
