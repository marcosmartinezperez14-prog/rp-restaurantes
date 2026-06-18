'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { guardarTema } from '@/app/actions/tema'

const TEMAS = [
  { id: 'slate',  label: 'Slate',  color: '#0f172a' },
  { id: 'ocean',  label: 'Ocean',  color: '#1d4ed8' },
  { id: 'sunset', label: 'Sunset', color: '#c2410c' },
  { id: 'forest', label: 'Forest', color: '#15803d' },
  { id: 'violet', label: 'Violet', color: '#7c3aed' },
]

export default function ThemeButton() {
  const [open, setOpen] = useState(false)
  const [tema, setTema] = useState(() =>
    typeof window !== 'undefined'
      ? (document.documentElement.dataset.theme ?? 'slate-light')
      : 'slate-light'
  )
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const partes = tema.split('-')
  const nombre = partes[0]
  const modo = partes[1] ?? 'light'

  function cambiarTema(nuevoTema: string) {
    setTema(nuevoTema)
    document.documentElement.setAttribute('data-theme', nuevoTema)
    startTransition(async () => {
      await guardarTema(nuevoTema)
    })
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Cambiar tema"
        style={{
          width: 34, height: 34, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? 'var(--bg-page)' : 'transparent',
          border: '1px solid var(--border)',
          cursor: 'pointer', transition: 'background .15s',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a10 10 0 0 1 0 20"/>
          <path d="M8 12a4 4 0 0 0 8 0"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-48">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tema</p>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {TEMAS.map(t => (
              <button
                key={t.id}
                onClick={() => cambiarTema(`${t.id}-${modo}`)}
                title={t.label}
                className={`h-6 rounded-md transition-all ${
                  nombre === t.id ? 'ring-2 ring-offset-1 ring-gray-800' : 'hover:scale-110'
                }`}
                style={{ background: t.color }}
              />
            ))}
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Modo</p>
          <div className="flex gap-1.5">
            {[
              { id: 'light', label: '☀️ Claro' },
              { id: 'dark',  label: '🌙 Oscuro' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => cambiarTema(`${nombre}-${m.id}`)}
                className={`flex-1 text-[11px] font-medium py-1 rounded-lg border transition-colors ${
                  modo === m.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
