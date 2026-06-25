export default function CancelacionPanel() {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 15, padding: 20, boxShadow: '0 1px 2px rgba(20,23,29,0.04)' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#1b1e24' }}>Cancelar suscripción</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: '#6b6f77', lineHeight: 1.55 }}>
        Si deseas cancelar tu suscripción, ponte en contacto con nosotros y lo gestionamos contigo personalmente.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>

        <a
          href="mailto:penekejunior@gmail.com"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: 13, fontWeight: 600, color: '#3b4151',
            background: '#f4f4f5', border: '1px solid #e6e6e8',
            borderRadius: 9, padding: '8px 14px', textDecoration: 'none',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
          </svg>
          penekejunior@gmail.com
        </a>

        <a
          href="https://wa.me/34652575742"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: 13, fontWeight: 600, color: '#16a34a',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 9, padding: '8px 14px', textDecoration: 'none',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          WhatsApp
        </a>
      </div>

      <p style={{ margin: '14px 0 0', fontSize: 12, color: '#a7a9af' }}>
        Puedes cancelar en cualquier momento. Sin permanencia.
      </p>
    </div>
  )
}
