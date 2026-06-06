import Link from 'next/link'

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
        <h1 className="text-[15px] font-semibold text-white">{title}</h1>
      </header>
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
