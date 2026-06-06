'use client'

import { useTransition } from 'react'
import { guardarTema } from '@/app/actions/tema'

const TEMAS = [
  { id: 'slate', label: 'Slate', color: '#0f172a' },
  { id: 'ocean', label: 'Ocean', color: '#1d4ed8' },
  { id: 'sunset', label: 'Sunset', color: '#c2410c' },
]

interface Props {
  temaActual: string
}

export default function AparienciaPanel({ temaActual }: Props) {
  const [isPending, startTransition] = useTransition()
  const [nombreActual, modoActual] = temaActual.split('-') as [string, string]

  function cambiarTema(nuevoTema: string) {
    document.documentElement.setAttribute('data-theme', nuevoTema)
    startTransition(async () => {
      await guardarTema(nuevoTema)
    })
  }

  function setNombre(nombre: string) {
    cambiarTema(`${nombre}-${modoActual}`)
  }

  function setModo(modo: string) {
    cambiarTema(`${nombreActual}-${modo}`)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Apariencia</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-8">
        Personaliza el aspecto visual de la aplicación. Los cambios se aplican en todos tus dispositivos.
      </p>

      {/* Color del tema */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Color del tema</p>
        <div className="grid grid-cols-3 gap-3">
          {TEMAS.map((t) => {
            const activo = nombreActual === t.id
            return (
              <button
                key={t.id}
                onClick={() => setNombre(t.id)}
                disabled={isPending}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  activo
                    ? 'border-[var(--primary)] bg-[var(--bg-surface)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-secondary)]'
                }`}
              >
                <div
                  className="w-full h-10 rounded-lg mb-2"
                  style={{ background: t.color }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{t.label}</span>
                  {activo && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: t.color }}>
                      Activo
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modo */}
      <div>
        <p className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Modo</p>
        <div className="flex gap-3">
          {[
            { id: 'light', label: 'Claro', icon: '☀️' },
            { id: 'dark', label: 'Oscuro', icon: '🌙' },
          ].map((m) => {
            const activo = modoActual === m.id
            return (
              <button
                key={m.id}
                onClick={() => setModo(m.id)}
                disabled={isPending}
                className={`flex-1 rounded-xl border-2 p-4 text-center transition-all ${
                  activo
                    ? 'border-[var(--primary)] bg-[var(--bg-surface)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-secondary)]'
                }`}
              >
                <div className="text-2xl mb-1">{m.icon}</div>
                <div className={`text-sm font-semibold ${activo ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {m.label}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {isPending && (
        <p className="text-xs text-[var(--text-secondary)] mt-4">Guardando...</p>
      )}
    </div>
  )
}
