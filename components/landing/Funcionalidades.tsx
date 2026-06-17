const FEATURES = [
  { icono: '—', titulo: 'TPV táctil', desc: 'Comandas, mesas, cobros y división de cuenta desde cualquier tablet o móvil.' },
  { icono: '—', titulo: 'Carta digital con QR', desc: 'Menú digital con foto y alérgenos. Tus clientes escanean y ven la carta al instante.' },
  { icono: '—', titulo: 'Gestión de reservas', desc: 'Reservas online con confirmación automática y registro conforme al RGPD.' },
  { icono: '—', titulo: 'Facturación Verifactu', desc: 'Cada ticket queda registrado automáticamente en Hacienda. Sin trabajo manual.' },
  { icono: '—', titulo: 'Informes y finanzas', desc: 'Cierres de caja, ventas por categoría y resumen diario en tiempo real.' },
]

export default function Funcionalidades() {
  return (
    <section className="py-24 px-4 bg-white" id="funcionalidades">
      <div className="max-w-5xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-semibold text-[#1A2B4A] text-center mb-4"
          style={{ fontFamily: 'var(--font-lora)' }}
        >
          Todo lo que necesita tu negocio
        </h2>
        <p className="text-gray-500 text-center mb-16 text-base" style={{ fontFamily: 'var(--font-inter)' }}>
          Un sistema completo, diseñado para la hostelería española
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200">
          {FEATURES.map(f => (
            <div key={f.titulo} className="bg-white p-8">
              <div
                className="text-xs font-semibold text-[#B8860B] tracking-widest uppercase mb-4"
                style={{ fontFamily: 'var(--font-inter)' }}
              >
                Incluido
              </div>
              <h3
                className="font-semibold text-[#1A2B4A] mb-3 text-lg"
                style={{ fontFamily: 'var(--font-lora)' }}
              >
                {f.titulo}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'var(--font-inter)' }}>
                {f.desc}
              </p>
            </div>
          ))}
          {/* Celda de relleno para completar la cuadrícula */}
          <div className="bg-[#F7F6F3] p-8 hidden lg:flex items-center justify-center">
            <p
              className="text-sm text-gray-400 text-center leading-relaxed"
              style={{ fontFamily: 'var(--font-inter)' }}
            >
              ¿Necesitas algo más?<br />
              <a href="#contacto" className="text-[#1E4080] underline underline-offset-2 hover:text-[#163260]">
                Cuéntanos tu caso
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
