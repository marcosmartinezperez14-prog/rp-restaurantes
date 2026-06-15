# Sistema de Temas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir los temas Forest y Violet (con variantes claro/oscuro) al sistema de temas existente, y un botón 🎨 en el AppShell header para cambiar el tema sin ir a Configuración.

**Architecture:** El sistema ya usa `data-theme` en `<html>` con CSS custom properties. Solo hay que añadir 4 bloques CSS nuevos, registrar los temas en la action de validación, añadirlos al panel de apariencia, y crear un `ThemeButton` cliente que lee el tema activo del DOM (`document.documentElement.dataset.theme`) y llama a `guardarTema`. AppShell sigue siendo server component — simplemente renderiza `<ThemeButton>` dentro del header.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, Supabase, TypeScript

---

## Archivos a crear/modificar

| Acción | Ruta |
|---|---|
| MODIFICAR | `app/globals.css` |
| MODIFICAR | `app/actions/tema.ts` |
| MODIFICAR | `components/configuracion/AparienciaPanel.tsx` |
| CREAR | `components/ThemeButton.tsx` |
| MODIFICAR | `components/AppShell.tsx` |

---

## Task 1: CSS — temas Forest y Violet

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Añadir los 4 bloques de tema al final de globals.css (antes de `body`)**

El archivo `app/globals.css` actualmente termina con `sunset-dark` en la línea 80, seguido del bloque `body`. Insertar los 4 bloques nuevos entre `sunset-dark` y `body`:

```css
/* ─── Tema: Forest Light ───────────────────────────────────── */
[data-theme="forest-light"] {
  --primary:          #15803d;
  --primary-hover:    #166534;
  --bg-page:          #f0fdf4;
  --bg-surface:       #ffffff;
  --bg-surface-hover: #dcfce7;
  --text-primary:     #0f172a;
  --text-secondary:   #64748b;
  --text-muted:       #374151;
  --border:           #e2e8f0;
}

/* ─── Tema: Forest Dark ────────────────────────────────────── */
[data-theme="forest-dark"] {
  --primary:          #15803d;
  --primary-hover:    #166534;
  --bg-page:          #052e16;
  --bg-surface:       #14532d;
  --bg-surface-hover: #166534;
  --text-primary:     #f1f5f9;
  --text-secondary:   #86efac;
  --text-muted:       #bbf7d0;
  --border:           #166534;
}

/* ─── Tema: Violet Light ───────────────────────────────────── */
[data-theme="violet-light"] {
  --primary:          #7c3aed;
  --primary-hover:    #6d28d9;
  --bg-page:          #faf5ff;
  --bg-surface:       #ffffff;
  --bg-surface-hover: #f3e8ff;
  --text-primary:     #0f172a;
  --text-secondary:   #64748b;
  --text-muted:       #374151;
  --border:           #e2e8f0;
}

/* ─── Tema: Violet Dark ────────────────────────────────────── */
[data-theme="violet-dark"] {
  --primary:          #7c3aed;
  --primary-hover:    #6d28d9;
  --bg-page:          #1e0a3c;
  --bg-surface:       #2e1065;
  --bg-surface-hover: #3b0764;
  --text-primary:     #f1f5f9;
  --text-secondary:   #c4b5fd;
  --text-muted:       #ddd6fe;
  --border:           #3b0764;
}
```

El archivo completo de `app/globals.css` quedará:

```css
@import "tailwindcss";

/* ─── Tema: Slate Light (default) ─────────────────────────── */
:root,
[data-theme="slate-light"] {
  --primary:          #0f172a;
  --primary-hover:    #1e293b;
  --bg-page:          #f4f6f9;
  --bg-surface:       #ffffff;
  --bg-surface-hover: #f8fafc;
  --text-primary:     #0f172a;
  --text-secondary:   #64748b;
  --text-muted:       #374151;
  --border:           #e2e8f0;
}

/* ─── Tema: Slate Dark ─────────────────────────────────────── */
[data-theme="slate-dark"] {
  --primary:          #1e293b;
  --primary-hover:    #334155;
  --bg-page:          #0f172a;
  --bg-surface:       #1e293b;
  --bg-surface-hover: #334155;
  --text-primary:     #f1f5f9;
  --text-secondary:   #94a3b8;
  --text-muted:       #cbd5e1;
  --border:           #334155;
}

/* ─── Tema: Ocean Light ────────────────────────────────────── */
[data-theme="ocean-light"] {
  --primary:          #1d4ed8;
  --primary-hover:    #1e40af;
  --bg-page:          #f0f7ff;
  --bg-surface:       #ffffff;
  --bg-surface-hover: #eff6ff;
  --text-primary:     #0f172a;
  --text-secondary:   #64748b;
  --text-muted:       #374151;
  --border:           #e2e8f0;
}

/* ─── Tema: Ocean Dark ─────────────────────────────────────── */
[data-theme="ocean-dark"] {
  --primary:          #1d4ed8;
  --primary-hover:    #1e40af;
  --bg-page:          #0a0f1e;
  --bg-surface:       #0f1a2e;
  --bg-surface-hover: #1e3a5f;
  --text-primary:     #f1f5f9;
  --text-secondary:   #93c5fd;
  --text-muted:       #bfdbfe;
  --border:           #1e3a5f;
}

/* ─── Tema: Sunset Light ───────────────────────────────────── */
[data-theme="sunset-light"] {
  --primary:          #c2410c;
  --primary-hover:    #9a3412;
  --bg-page:          #fff7ed;
  --bg-surface:       #ffffff;
  --bg-surface-hover: #ffedd5;
  --text-primary:     #0f172a;
  --text-secondary:   #64748b;
  --text-muted:       #374151;
  --border:           #e2e8f0;
}

/* ─── Tema: Sunset Dark ────────────────────────────────────── */
[data-theme="sunset-dark"] {
  --primary:          #c2410c;
  --primary-hover:    #9a3412;
  --bg-page:          #0c0a09;
  --bg-surface:       #1c1917;
  --bg-surface-hover: #292524;
  --text-primary:     #f1f5f9;
  --text-secondary:   #a8a29e;
  --text-muted:       #d6d3d1;
  --border:           #292524;
}

/* ─── Tema: Forest Light ───────────────────────────────────── */
[data-theme="forest-light"] {
  --primary:          #15803d;
  --primary-hover:    #166534;
  --bg-page:          #f0fdf4;
  --bg-surface:       #ffffff;
  --bg-surface-hover: #dcfce7;
  --text-primary:     #0f172a;
  --text-secondary:   #64748b;
  --text-muted:       #374151;
  --border:           #e2e8f0;
}

/* ─── Tema: Forest Dark ────────────────────────────────────── */
[data-theme="forest-dark"] {
  --primary:          #15803d;
  --primary-hover:    #166534;
  --bg-page:          #052e16;
  --bg-surface:       #14532d;
  --bg-surface-hover: #166534;
  --text-primary:     #f1f5f9;
  --text-secondary:   #86efac;
  --text-muted:       #bbf7d0;
  --border:           #166534;
}

/* ─── Tema: Violet Light ───────────────────────────────────── */
[data-theme="violet-light"] {
  --primary:          #7c3aed;
  --primary-hover:    #6d28d9;
  --bg-page:          #faf5ff;
  --bg-surface:       #ffffff;
  --bg-surface-hover: #f3e8ff;
  --text-primary:     #0f172a;
  --text-secondary:   #64748b;
  --text-muted:       #374151;
  --border:           #e2e8f0;
}

/* ─── Tema: Violet Dark ────────────────────────────────────── */
[data-theme="violet-dark"] {
  --primary:          #7c3aed;
  --primary-hover:    #6d28d9;
  --bg-page:          #1e0a3c;
  --bg-surface:       #2e1065;
  --bg-surface-hover: #3b0764;
  --text-primary:     #f1f5f9;
  --text-secondary:   #c4b5fd;
  --text-muted:       #ddd6fe;
  --border:           #3b0764;
}

body {
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: Arial, Helvetica, sans-serif;
}

input, select, textarea {
  color: var(--text-primary) !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: CSS variables para temas Forest y Violet (light/dark)"
```

---

## Task 2: Registrar los nuevos temas en la server action

**Files:**
- Modify: `app/actions/tema.ts`

- [ ] **Step 1: Añadir forest y violet a TEMAS_VALIDOS**

Reemplazar el contenido de `app/actions/tema.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const TEMAS_VALIDOS = [
  'slate-light',  'slate-dark',
  'ocean-light',  'ocean-dark',
  'sunset-light', 'sunset-dark',
  'forest-light', 'forest-dark',
  'violet-light', 'violet-dark',
]

export async function guardarTema(tema: string): Promise<{ error?: string }> {
  if (!TEMAS_VALIDOS.includes(tema)) return { error: 'Tema no válido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('users')
    .update({ theme: tema })
    .eq('auth_id', user.id)

  if (error) return { error: error.message }

  return {}
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/tema.ts
git commit -m "feat: registrar forest y violet en TEMAS_VALIDOS"
```

---

## Task 3: Actualizar el panel de apariencia con los 5 temas

**Files:**
- Modify: `components/configuracion/AparienciaPanel.tsx`

- [ ] **Step 1: Añadir Forest y Violet al array TEMAS y ajustar el grid a 5 columnas**

Reemplazar el contenido completo de `components/configuracion/AparienciaPanel.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add components/configuracion/AparienciaPanel.tsx
git commit -m "feat: añadir Forest y Violet al panel de apariencia"
```

---

## Task 4: ThemeButton — acceso rápido al tema desde el header

**Files:**
- Create: `components/ThemeButton.tsx`

- [ ] **Step 1: Crear el componente ThemeButton**

El componente lee el tema activo del DOM en el montaje (vía `useEffect`), y al hacer clic muestra un pequeño panel flotante con los 5 colores y 2 modos.

Crear `components/ThemeButton.tsx`:

```typescript
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
  const [tema, setTema] = useState('slate-light')
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const current = document.documentElement.dataset.theme ?? 'slate-light'
    setTema(current)
  }, [])

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
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          open ? 'bg-white/20' : 'hover:bg-white/10'
        } ${isPending ? 'opacity-60' : ''}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a10 10 0 0 1 0 20"/>
          <path d="M8 12a4 4 0 0 0 8 0"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-48">
          {/* Colores */}
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
          {/* Modo */}
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
```

- [ ] **Step 2: Commit**

```bash
git add components/ThemeButton.tsx
git commit -m "feat: ThemeButton con dropdown de temas en el header"
```

---

## Task 5: Integrar ThemeButton en AppShell

**Files:**
- Modify: `components/AppShell.tsx`

- [ ] **Step 1: Importar y renderizar ThemeButton en el header**

Reemplazar el contenido completo de `components/AppShell.tsx`:

```typescript
import Link from 'next/link'
import ThemeButton from './ThemeButton'

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
      <header className="bg-[var(--primary)] px-4 h-[52px] flex items-center gap-3 flex-shrink-0 shadow-sm">
        <Link
          href="/dashboard"
          className="text-[var(--text-secondary)] hover:text-white transition-colors flex-shrink-0"
          aria-label="Ir al inicio"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </Link>
        <h1 className="text-[15px] font-semibold text-white flex-1">{title}</h1>
        <ThemeButton />
      </header>
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AppShell.tsx
git commit -m "feat: ThemeButton en el header de AppShell"
```

---

## Self-Review

**Spec coverage:**
- ✅ CSS: forest-light, forest-dark, violet-light, violet-dark con las paletas del brainstorm
- ✅ `guardarTema` acepta los 10 temas (5 × 2 modos)
- ✅ Panel de apariencia muestra los 5 temas en grid-cols-5
- ✅ `ThemeButton` en el header: colores + toggle claro/oscuro
- ✅ Cambio instantáneo vía `data-theme` + persistencia en Supabase
- ✅ AppShell sigue siendo server component (ThemeButton es el único cliente)
- ✅ Click fuera del panel lo cierra (listener en `useEffect`)

**Temas no tocados:**
- `app/layout.tsx` — ya lee `users.theme` y pone `data-theme` en `<html>`, no necesita cambios
- SQL — no hay nueva columna, `users.theme` ya existe
