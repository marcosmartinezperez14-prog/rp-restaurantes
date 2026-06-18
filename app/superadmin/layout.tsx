import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperadmin } from '@/lib/auth/superadmin'
import Link from 'next/link'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!await isSuperadmin(supabase, user.id)) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">
          RP · Superadmin
        </span>
        <nav className="flex items-center gap-1">
          <Link
            href="/superadmin"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Restaurantes
          </Link>
          <Link
            href="/superadmin/papelera"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            🗑️ Papelera
          </Link>
        </nav>
      </header>
      {children}
    </div>
  )
}
