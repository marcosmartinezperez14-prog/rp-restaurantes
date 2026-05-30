// app/dashboard/LogoutButton.tsx
'use client'

import { logoutAction } from '@/app/actions/auth'

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
      >
        Cerrar sesión
      </button>
    </form>
  )
}
