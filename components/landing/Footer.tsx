import { CONTACTO_EMAIL } from '@/lib/config/landing'

export default function Footer() {
  return (
    <footer className="bg-[#1A2B4A] text-slate-400 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <p
            className="text-white font-semibold text-lg"
            style={{ fontFamily: 'var(--font-lora)' }}
          >
            RP Restaurantes
          </p>
          <div
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            <a href="/privacidad" className="hover:text-white transition-colors">Política de privacidad</a>
            <a href="/aviso-legal" className="hover:text-white transition-colors">Aviso legal</a>
            <a href="/cookies" className="hover:text-white transition-colors">Política de cookies</a>
            <a href={`mailto:${CONTACTO_EMAIL}`} className="hover:text-white transition-colors">{CONTACTO_EMAIL}</a>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6">
          <p
            className="text-xs text-slate-500"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            © {new Date().getFullYear()} RP Restaurantes. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
