import { PLANES } from '@/lib/config/landing'

export default function Pricing({ onCtaClick }: { onCtaClick?: (planNombre: string) => void }) {
  return (
    <section id="pricing" style={{ maxWidth: 1180, margin: '0 auto', padding: '70px 28px' }}>
      <h2 className="pricing-heading">
        Precios claros, sin sorpresas
      </h2>
      <p style={{ textAlign: 'center', color: '#5B6477', fontSize: 17, margin: '0 0 44px' }}>
        Empieza por un local y crece cuando quieras.
      </p>
      <div className="pricing-grid">
        {PLANES.map(plan => (
          plan.destacado ? (
            <div key={plan.id} style={{
              background: '#0B1020', color: '#fff',
              borderRadius: 20, padding: 30,
              boxShadow: '0 24px 60px rgba(11,16,32,0.28)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute', top: -12, left: 30,
                background: '#2F54EB', color: '#fff',
                fontSize: 12, fontWeight: 700,
                padding: '6px 13px', borderRadius: 999
              }}>
                Más elegido
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#9AA4BD', marginBottom: 10 }}>
                {plan.nombre}
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {plan.precio}€<span style={{ fontSize: 16, color: '#9AA4BD', fontWeight: 600 }}>/mes</span>
              </div>
              <p style={{ fontSize: 14, color: '#9AA4BD', margin: '8px 0 20px' }}>{plan.descripcion}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: '#D7DCEA' }}>
                {plan.features.map(f => <span key={f}>✓ {f}</span>)}
              </div>
              <button
                onClick={() => onCtaClick?.(plan.id)}
                style={{
                  width: '100%', marginTop: 24, background: '#2F54EB', color: '#fff',
                  border: 'none', padding: 13, borderRadius: 11,
                  fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: 15
                }}
              >
                Contratar {plan.nombre}
              </button>
            </div>
          ) : (
            <div key={plan.id} style={{
              background: '#fff', border: '1px solid #E6EAF3',
              borderRadius: 20, padding: 30
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#5B6477', marginBottom: 10 }}>
                {plan.nombre}
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {plan.precio}€<span style={{ fontSize: 16, color: '#8A93A6', fontWeight: 600 }}>/mes</span>
              </div>
              <p style={{ fontSize: 14, color: '#5B6477', margin: '8px 0 20px' }}>{plan.descripcion}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: '#3A4255' }}>
                {plan.features.map(f => <span key={f}>✓ {f}</span>)}
              </div>
              <button
                onClick={() => onCtaClick?.(plan.id)}
                style={{
                  width: '100%', marginTop: 24, background: '#fff', color: '#0B1020',
                  border: '1.5px solid #D9DFEC', padding: 13, borderRadius: 11,
                  fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: 15
                }}
              >
                Contratar {plan.nombre}
              </button>
            </div>
          )
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#8A93A6', textAlign: 'center', marginTop: 20 }}>
        El precio del montaje inicial se acuerda individualmente según las necesidades de tu negocio.
      </p>
      <style>{`
        .pricing-heading {
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -0.025em;
          text-align: center;
          margin: 0 0 8px;
        }
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .pricing-grid { grid-template-columns: 1fr; max-width: 460px; margin: 0 auto; }
          .pricing-heading { font-size: 28px; }
        }
      `}</style>
    </section>
  )
}
