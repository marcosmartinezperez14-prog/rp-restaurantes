import { CONTACTO_EMAIL } from '@/lib/config/landing'

export default function Footer() {
  return (
    <footer style={{
      background: '#0B1020', color: '#9AA4BD',
      padding: '48px 28px', fontFamily: 'var(--font-plus-jakarta)'
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: 24, marginBottom: 32
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: '#2F54EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 15
            }}>G</div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>GestionBar</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 14 }}>
            <a href="/privacidad" style={{ color: 'inherit', textDecoration: 'none' }}>Política de privacidad</a>
            <a href="/aviso-legal" style={{ color: 'inherit', textDecoration: 'none' }}>Aviso legal</a>
            <a href="/cookies" style={{ color: 'inherit', textDecoration: 'none' }}>Política de cookies</a>
            <a href={`mailto:${CONTACTO_EMAIL}`} style={{ color: 'inherit', textDecoration: 'none' }}>{CONTACTO_EMAIL}</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24 }}>
          <p style={{ fontSize: 12, color: '#4A5568', margin: 0 }}>
            © {new Date().getFullYear()} GestionBar. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
