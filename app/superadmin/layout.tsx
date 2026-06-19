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
    <div className="min-h-screen bg-[var(--bg-page)]">
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-6 py-3 flex items-center gap-6">
        <span className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          RP · Superadmin
        </span>
        <nav className="flex items-center gap-1">
          <Link
            href="/superadmin"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-page)] transition-colors"
          >
            Restaurantes
          </Link>
          <Link
            href="/superadmin/nuevo"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            + Nuevo restaurante
          </Link>
          <Link
            href="/superadmin/papelera"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-page)] transition-colors"
          >
            🗑️ Papelera
          </Link>
        </nav>
      </header>
      {children}
    </div>
  )
}
