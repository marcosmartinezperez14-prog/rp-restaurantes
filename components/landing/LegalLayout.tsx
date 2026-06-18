import Link from 'next/link'

interface Props {
  titulo: string
  actualizado: string
  children: React.ReactNode
}

export default function LegalLayout({ titulo, actualizado, children }: Props) {
  return (
    <div style={{ fontFamily: 'var(--font-plus-jakarta)', background: '#fff', color: '#0B1020', minHeight: '100vh' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1180, margin: '0 auto', padding: '20px 28px',
        borderBottom: '1px solid #F0F2F8',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: '#2F54EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 15,
          }}>R</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>RP Restaurantes</span>
        </Link>
        <Link href="/" style={{ fontSize: 14, color: '#5B6477', textDecoration: 'none', fontWeight: 500 }}>
          ← Volver
        </Link>
      </nav>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '56px 28px 80px' }}>
        <p style={{ fontSize: 13, color: '#8A93A6', margin: '0 0 12px' }}>Última actualización: {actualizado}</p>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 40px' }}>{titulo}</h1>
        <div style={{ fontSize: 15, lineHeight: 1.75, color: '#3A4255' }}>
          {children}
        </div>
      </main>

      <footer style={{
        borderTop: '1px solid #F0F2F8', padding: '24px 28px',
        textAlign: 'center', fontSize: 13, color: '#8A93A6',
      }}>
        © {new Date().getFullYear()} RP Restaurantes · {' '}
        <Link href="/aviso-legal" style={{ color: 'inherit' }}>Aviso legal</Link> · {' '}
        <Link href="/privacidad" style={{ color: 'inherit' }}>Privacidad</Link> · {' '}
        <Link href="/cookies" style={{ color: 'inherit' }}>Cookies</Link>
      </footer>
    </div>
  )
}
