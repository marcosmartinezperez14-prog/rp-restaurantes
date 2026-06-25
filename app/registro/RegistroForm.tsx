// app/registro/RegistroForm.tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { registerAction } from '@/app/actions/auth'

export default function RegistroForm() {
  const [state, action, pending] = useActionState(registerAction, undefined)

  if (state?.success) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-md p-8">
          <p className="text-center text-sm text-[var(--text-secondary)] mb-4">GestionBar</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-800 font-medium">¡Registro exitoso!</p>
            <p className="text-green-700 text-sm mt-1">
              Tu cuenta ha sido creada. Ya puedes iniciar sesión con tu usuario y contraseña.
            </p>
          </div>
          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-md p-8">
        <p className="text-center text-sm text-[var(--text-secondary)] mb-1">GestionBar</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-6">
          Crear cuenta
        </h1>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="restaurant_name"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              Nombre del restaurante
            </label>
            <input
              id="restaurant_name"
              name="restaurant_name"
              type="text"
              placeholder="Mi Restaurante"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="nif"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              NIF
            </label>
            <input
              id="nif"
              name="nif"
              type="text"
              placeholder="B12345678"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              Tu nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Juan García"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="nombre_usuario"
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
              autoComplete="new-password"
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
            {pending ? 'Cargando...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
