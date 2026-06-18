// app/login/LoginForm.tsx
'use client'

import { useActionState } from 'react'
import { loginAction } from '@/app/actions/auth'

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined)

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-md p-8">
        <p className="text-center text-sm text-[var(--text-secondary)] mb-1">RP Restaurantes</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-6">
          Iniciar sesión
        </h1>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              Usuario o email
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="nombre_usuario o correo@ejemplo.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
          </div>

          {state?.error && (
            <p className="text-red-600 text-sm text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {pending ? 'Cargando...' : 'Iniciar sesión'}
          </button>
        </form>

      </div>
    </div>
  )
}
