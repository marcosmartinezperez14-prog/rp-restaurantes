// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center">
        <p className="text-sm text-gray-500 mb-1">RP Restaurantes</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Panel de control</h1>
        <p className="text-gray-900 mb-6">
          Bienvenido,{' '}
          <span className="font-medium text-gray-900">{user.email}</span>
        </p>
        <LogoutButton />
      </div>
    </div>
  )
}
