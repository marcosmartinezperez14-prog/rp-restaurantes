const FEATURES = [
  {
    title: 'TPV / Punto de venta',
    desc: 'Cobra rápido desde tablet, móvil o caja. Divide cuentas y aplica descuentos en segundos.',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="13" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/></svg>',
  },
  {
    title: 'Mesas y reservas',
    desc: 'Mapa de sala en vivo y reservas online. Sabes qué mesa está libre, ocupada o por cobrar.',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><circle cx="12" cy="15" r="2"/></svg>',
  },
  {
    title: 'Carta digital con QR',
    desc: 'Tu carta siempre actualizada. El cliente pide desde su móvil escaneando el código.',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="18" y1="14" x2="21" y2="14"/><line x1="18" y1="18" x2="21" y2="21"/></svg>',
  },
  {
    title: 'Comandas a cocina (KDS)',
    desc: 'Cada pedido llega a la pantalla de cocina al instante. Cero papeles, cero errores.',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="13" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/><polyline points="8 8 10 10 8 12"/><line x1="13" y1="12" x2="16" y2="12"/></svg>',
  },
  {
    title: 'Gestión de personal',
    desc: 'Turnos, fichajes y roles por empleado. Controla quién hace qué en cada servicio.',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.2"/><path d="M16 14a5 5 0 0 1 5 5"/></svg>',
  },
  {
    title: 'Facturación Verifactu',
    desc: 'Cada ticket queda registrado automáticamente en Hacienda. Sin trabajo manual ni multas.',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>',
  },
]

export default function Funcionalidades() {
  return (
    <section id="funcionalidades" style={{ maxWidth: 1180, margin: '0 auto', padding: '60px 28px' }}>
      <h2 style={{
        fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em',
        textAlign: 'center', margin: '0 0 8px'
      }}>
        Una sola herramienta para todo el servicio
      </h2>
      <p style={{
        textAlign: 'center', color: '#5B6477', fontSize: 17,
        margin: '0 auto 44px', maxWidth: 540
      }}>
        Diseñado para restaurantes independientes, bares y cafeterías.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{
            background: '#F6F7FB', border: '1px solid #EEF1F8',
            borderRadius: 18, padding: 26
          }}>
            <div
              style={{
                width: 46, height: 46, borderRadius: 12,
                background: '#E8EDFF', color: '#2F54EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}
              dangerouslySetInnerHTML={{ __html: f.icon }}
            />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 7px' }}>{f.title}</h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: '#5B6477', margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
