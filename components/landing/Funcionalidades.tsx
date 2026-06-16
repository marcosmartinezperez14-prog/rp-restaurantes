const FEATURES = [
  { emoji: '💳', titulo: 'TPV táctil', desc: 'Comandas, mesas, cobros y división de cuenta desde cualquier tablet o móvil.' },
  { emoji: '📱', titulo: 'Carta digital + QR', desc: 'Menú digital con foto y alérgenos. Tus clientes escanean el QR y ven la carta al instante.' },
  { emoji: '📅', titulo: 'Gestión de reservas', desc: 'Reservas online con confirmación automática y registro de datos conforme al RGPD.' },
  { emoji: '🧾', titulo: 'Facturación Verifactu', desc: 'Cumple con el reglamento fiscal de Hacienda. Cada ticket queda registrado automáticamente.' },
  { emoji: '📊', titulo: 'Informes y finanzas', desc: 'Cierres de caja, ventas por categoría y resumen diario. Todo en tiempo real.' },
]

export default function Funcionalidades() {
  return (
    <section className="py-20 px-4 bg-slate-50" id="funcionalidades">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Todo lo que necesita tu negocio</h2>
        <p className="text-slate-500 text-center mb-14">Un sistema completo, diseñado para la hostelería española</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div key={f.titulo} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="text-3xl mb-3">{f.emoji}</div>
              <h3 className="font-bold text-slate-900 mb-2">{f.titulo}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
