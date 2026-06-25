'use client'

export default function Hero({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <header className="hero-section">
      <div className="hero-text" style={{ animation: 'svFade .6s ease both' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#E8EDFF', color: '#2F54EB',
          padding: '7px 14px', borderRadius: 999,
          fontSize: 13, fontWeight: 600, marginBottom: 22
        }}>
          Software de gestión gastronómica
        </div>
        <h1 className="hero-h1">
          Todo tu restaurante en un solo lugar
        </h1>
        <p style={{
          fontSize: 19, lineHeight: 1.55, color: '#5B6477',
          margin: '0 0 30px', maxWidth: 480
        }}>
          TPV, mesas, carta digital, cocina y personal conectados en tiempo real.
          Menos caos en el servicio, más mesas atendidas.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={onCtaClick}
            style={{
              background: '#2F54EB', color: '#fff', border: 'none',
              padding: '15px 26px', borderRadius: 11, fontFamily: 'inherit',
              fontWeight: 600, fontSize: 16, cursor: 'pointer',
              boxShadow: '0 10px 26px rgba(47,84,235,0.32)'
            }}
          >
            Contactar ventas
          </button>
          <a href="#funcionalidades" style={{
            background: '#fff', color: '#0B1020',
            border: '1.5px solid #E1E5F0', padding: '15px 26px',
            borderRadius: 11, fontFamily: 'inherit', fontWeight: 600,
            fontSize: 16, cursor: 'pointer', textDecoration: 'none',
            display: 'inline-block'
          }}>
            Ver funciones
          </a>
        </div>
        <p style={{ fontSize: 13, color: '#8A93A6', margin: '22px 0 0' }}>
          Sin permanencia · Soporte en español · Instalación guiada
        </p>
      </div>

      {/* Dashboard mockup */}
      <div className="hero-mockup" style={{ animation: 'svFloat 6s ease-in-out infinite' }}>
        <div style={{
          background: '#F6F7FB', border: '1px solid #ECEFF6',
          borderRadius: 22, padding: 18,
          boxShadow: '0 30px 70px rgba(16,24,64,0.14)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Ventas hoy', val: '€2.480' },
              { label: 'Tickets', val: '86' },
              { label: 'Ticket medio', val: '€28' },
            ].map(item => (
              <div key={item.label} style={{
                background: '#fff', borderRadius: 13, padding: 14, border: '1px solid #EEF1F8'
              }}>
                <div style={{ fontSize: 12, color: '#8A93A6', marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{item.val}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', borderRadius: 13, border: '1px solid #EEF1F8', overflow: 'hidden' }}>
            {[
              { mesa: 'Mesa 7 · 4 comensales', estado: 'En cocina', color: '#2F54EB' },
              { mesa: 'Mesa 3 · 2 comensales', estado: 'Servido', color: '#16794A' },
              { mesa: 'Barra · 1 comensal', estado: 'Por cobrar', color: '#B45309' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 15px',
                borderBottom: i < 2 ? '1px solid #F1F3F9' : undefined
              }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{row.mesa}</span>
                <span style={{ fontSize: 12, color: row.color, fontWeight: 600 }}>{row.estado}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .hero-section {
          max-width: 1180px;
          margin: 0 auto;
          padding: 56px 28px 40px;
          display: grid;
          grid-template-columns: 1.02fr 1fr;
          gap: 56px;
          align-items: center;
        }
        .hero-h1 {
          font-size: 56px;
          line-height: 1.04;
          letter-spacing: -0.03em;
          font-weight: 800;
          margin: 0 0 18px;
        }
        @keyframes svFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes svFade { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @media (max-width: 768px) {
          .hero-section {
            grid-template-columns: 1fr;
            gap: 32px;
            padding: 36px 20px 32px;
          }
          .hero-h1 {
            font-size: 36px;
          }
          .hero-mockup {
            animation: none !important;
          }
        }
      `}</style>
    </header>
  )
}
