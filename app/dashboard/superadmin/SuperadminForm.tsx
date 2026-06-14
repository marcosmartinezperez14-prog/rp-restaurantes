// app/dashboard/superadmin/SuperadminForm.tsx
'use client'

import { useActionState } from 'react'
import { crearRestauranteConAdmin, type SuperadminActionResult } from '@/app/actions/superadmin'

export default function SuperadminForm() {
  const [state, action, pending] = useActionState<SuperadminActionResult | undefined, FormData>(
    crearRestauranteConAdmin,
    undefined
  )

  if (state && 'success' in state && state.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
          <p className="text-center text-sm text-gray-500 mb-1">RP Restaurantes · Superadmin</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center mb-6">
            <p className="text-green-800 font-semibold">¡Restaurante creado!</p>
            <p className="text-green-700 text-sm mt-1">
              <strong>{state.restaurante}</strong> con admin <strong>{state.usuario}</strong>
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Crear otro restaurante
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <p className="text-center text-sm text-gray-500 mb-1">RP Restaurantes · Superadmin</p>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">
          Crear nuevo restaurante
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-800">
          ⚡ Esta acción crea el restaurante y su usuario admin directamente en producción.
        </div>

        <form action={action} className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Datos del restaurante
          </p>

          <div>
            <label htmlFor="restaurant_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del restaurante
            </label>
            <input
              id="restaurant_name"
              name="restaurant_name"
              type="text"
              placeholder="El Rincón de Madrid"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="nif" className="block text-sm font-medium text-gray-700 mb-1">
              NIF
            </label>
            <input
              id="nif"
              name="nif"
              type="text"
              placeholder="B12345678"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">
            Datos del usuario admin
          </p>

          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              placeholder="Juan García"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="juan_garcia"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Se usará como <em>usuario@rp-internal.com</em>
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres</p>
          </div>

          {state && 'error' in state && state.error && (
            <p className="text-red-600 text-sm text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {pending ? 'Creando...' : 'Crear restaurante y admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
