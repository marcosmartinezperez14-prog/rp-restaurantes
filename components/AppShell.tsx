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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <header style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        {/* Logo + nombre */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16,
          }}>R</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px', color: 'var(--text-primary)' }}>
              GestionBar
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
              PANEL DE CONTROL
            </div>
          </div>
        </Link>

        {/* Separador */}
        <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0, marginLeft: 4, marginRight: 4 }} />

        {/* Volver al dashboard */}
        <Link href="/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none',
          color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
          padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-page)', flexShrink: 0, transition: 'background .12s',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Dashboard
        </Link>

        {/* Separador */}
        <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

        {/* Título de página actual */}
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {title}
        </span>

        {/* Derecha: estado + theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--bg-page)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 11px',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--status-green)',
              boxShadow: '0 0 0 3px color-mix(in srgb, var(--status-green) 18%, transparent)',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
              OPERATIVO
            </span>
          </div>
          <ThemeButton />
        </div>
      </header>

      <main className="flex-1 overflow-auto" style={{ padding: '28px 32px' }}>
        {children}
      </main>
    </div>
  )
}
