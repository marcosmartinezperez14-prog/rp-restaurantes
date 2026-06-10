'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarTema } from '@/app/actions/tema'

const TEMAS = [
  { id: 'slate',  label: 'Slate',  color: '#0f172a' },
  { id: 'ocean',  label: 'Ocean',  color: '#1d4ed8' },
  { id: 'sunset', label: 'Sunset', color: '#c2410c' },
  { id: 'forest', label: 'Forest', color: '#15803d' },
  { id: 'violet', label: 'Violet', color: '#7c3aed' },
]

interface Props {
  temaActual: string
}

export default function AparienciaPanel({ temaActual }: Props) {
  const [tema, setTema] = useState(temaActual)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const partes = tema.split('-')
  const nombre = partes[0]
  const modo = partes[1] ?? 'light'

  function cambiarTema(nuevoTema: string) {
    setTema(nuevoTema)
    document.documentElement.setAttribute('data-theme', nuevoTema)
    setErrorMsg(null)
    startTransition(async () => {
      const result = await guardarTema(nuevoTema)
      if (result?.error) {
        setErrorMsg(result.error)
        setTema(temaActual)
        document.documentElement.setAttribute('data-theme', temaActual)
      } else {
        router.refresh()
      }
    })
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
        <div className="grid grid-cols-5 gap-2">
          {TEMAS.map((t) => {
            const activo = nombre === t.id
            return (
              <button
                key={t.id}
                onClick={() => cambiarTema(`${t.id}-${modo}`)}
                disabled={isPending}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  activo
                    ? 'border-[var(--primary)] bg-[var(--bg-surface)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-secondary)]'
                }`}
              >
                <div className="w-full h-8 rounded-lg mb-2" style={{ background: t.color }} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{t.label}</span>
                  {activo && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white text-center" style={{ background: t.color }}>
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
            const activo = modo === m.id
            return (
              <button
                key={m.id}
                onClick={() => cambiarTema(`${nombre}-${m.id}`)}
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
      {errorMsg && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{errorMsg}</p>
      )}
    </div>
  )
}
