const PASOS = [
  { n: '1', title: 'Configura tu carta', desc: 'Sube tus platos, precios y categorías. Define tus mesas y zonas de sala.' },
  { n: '2', title: 'Toma comandas', desc: 'Tu equipo apunta los pedidos desde cualquier dispositivo, junto a la mesa.' },
  { n: '3', title: 'La cocina recibe todo', desc: 'Las comandas llegan a la pantalla de cocina ordenadas y en tiempo real.' },
  { n: '4', title: 'Cobra y analiza', desc: 'Cierra cuentas en un toque y revisa tus ventas, ticket medio y horas punta.' },
]

export default function ComoFunciona() {
  return (
    <section id="como-funciona" style={{
      background: '#0B1020', color: '#fff',
      padding: '70px 28px', marginTop: 20
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h2 style={{
          fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em',
          textAlign: 'center', margin: '0 0 50px'
        }}>
          Listo para operar en 4 pasos
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 22 }}>
          {PASOS.map(s => (
            <div key={s.n}>
              <div style={{
                width: 42, height: 42, borderRadius: 11, background: '#2F54EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 17, marginBottom: 16
              }}>
                {s.n}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 7px' }}>{s.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: '#9AA4BD', margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
