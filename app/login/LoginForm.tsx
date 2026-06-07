// app/login/LoginForm.tsx
'use client'

import { useActionState } from 'react'
import { loginAction } from '@/app/actions/auth'

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <p className="text-center text-sm text-gray-500 mb-1">RP Restaurantes</p>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">
          Iniciar sesión
        </h1>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Usuario o email
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="nombre_usuario o correo@ejemplo.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {state?.error && (
            <p className="text-red-600 text-sm text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {pending ? 'Cargando...' : 'Iniciar sesión'}
          </button>
        </form>

      </div>
    </div>
  )
}
