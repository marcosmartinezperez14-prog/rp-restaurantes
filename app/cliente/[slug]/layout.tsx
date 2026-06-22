import CookieBanner from '@/components/cliente/CookieBanner'

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div style={{ minHeight: '100vh', background: '#EDEAE3' }}>
      <main>
        {children}
      </main>
      <footer style={{ padding: '20px 24px', textAlign: 'center', background: '#EDEAE3' }}>
        <nav style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', marginBottom: '8px' }}>
          <a href={`/cliente/${slug}/privacidad`} style={{ fontSize: '11px', color: '#AFA89A', textDecoration: 'none', fontFamily: "'Jost', system-ui, sans-serif", letterSpacing: '0.08em' }}>Privacidad</a>
          <a href={`/cliente/${slug}/aviso-legal`} style={{ fontSize: '11px', color: '#AFA89A', textDecoration: 'none', fontFamily: "'Jost', system-ui, sans-serif", letterSpacing: '0.08em' }}>Aviso legal</a>
          <a href={`/cliente/${slug}/cookies`} style={{ fontSize: '11px', color: '#AFA89A', textDecoration: 'none', fontFamily: "'Jost', system-ui, sans-serif", letterSpacing: '0.08em' }}>Cookies</a>
        </nav>
      </footer>
      <CookieBanner slug={slug} />
    </div>
  )
}
