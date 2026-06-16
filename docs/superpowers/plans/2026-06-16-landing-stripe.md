# Landing Pública + Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear landing pública en "/" con secciones de presentación, flujo de pago Stripe (subscription 97€/mes), formulario de contacto/demo, webhook de Stripe y panel de leads en /admin/leads.

**Architecture:** Server Components para la landing (sin JS innecesario), Client Components solo para el modal de checkout y el formulario de contacto. API routes para Stripe y contacto. supabaseAdmin (service_role) para escribir leads sin RLS.

**Tech Stack:** Next.js 16 App Router, Stripe SDK, Supabase (service_role), Zod, Tailwind CSS.

---

### Task 1: Migración SQL — leads_pago y leads_contacto

**Files:**
- Create: `supabase/migrations/012_leads.sql`

- [ ] Crear el archivo de migración:

```sql
-- Leads de pago (pre-Stripe) y contacto/demo. Sin RLS: acceso solo desde service_role.

create table if not exists public.leads_pago (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  nombre_restaurante  text not null,
  email               text not null,
  telefono            text not null,
  stripe_session_id   text null,
  estado              text not null default 'iniciado'
                        check (estado in ('iniciado','pagado','fallido')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.leads_contacto (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  nombre_restaurante  text not null,
  email               text not null,
  telefono            text not null,
  mensaje             text null,
  atendido            boolean not null default false,
  created_at          timestamptz not null default now()
);
```

- [ ] Pegar en Supabase SQL Editor y ejecutar. Verificar que ambas tablas aparecen en Table Editor.

---

### Task 2: Instalar Stripe SDK y configurar constantes

**Files:**
- Create: `lib/stripe.ts`
- Create: `lib/config/landing.ts`

- [ ] Instalar Stripe:

```bash
npm install stripe
```

- [ ] Crear `lib/stripe.ts`:

```typescript
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})
```

- [ ] Crear `lib/config/landing.ts`:

```typescript
export const PRECIO_MENSUAL = 97
export const PLAN_NOMBRE = 'Plan Restaurante'
export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID ?? ''
export const CONTACTO_EMAIL = 'hola@rp-restaurantes.com'
```

- [ ] Añadir las env vars al `.env.local` (valores de Stripe test mode):

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

- [ ] Commit:

```bash
git add lib/stripe.ts lib/config/landing.ts package.json package-lock.json
git commit -m "feat(landing): instalar stripe SDK y constantes de configuración"
```

---

### Task 3: API route POST /api/stripe/checkout

**Files:**
- Create: `app/api/stripe/checkout/route.ts`

- [ ] Crear `app/api/stripe/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { STRIPE_PRICE_ID } from '@/lib/config/landing'

const schema = z.object({
  nombre: z.string().trim().min(1).max(120),
  nombre_restaurante: z.string().trim().min(1).max(120),
  email: z.string().email('Email no válido'),
  telefono: z.string().trim().min(1).max(30),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(schema, await req.json().catch(() => null))
    if (!parsed.ok) return parsed.response

    const { nombre, nombre_restaurante, email, telefono } = parsed.data

    // Guardar lead antes de redirigir a Stripe
    const { data: lead, error: dbError } = await supabaseAdmin
      .from('leads_pago')
      .insert({ nombre, nombre_restaurante, email, telefono, estado: 'iniciado' })
      .select('id')
      .single()

    if (dbError || !lead) return jsonError('No se pudo procesar la solicitud', 500, dbError)

    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email,
      client_reference_id: lead.id,
      metadata: { lead_id: lead.id },
      success_url: `${origin}/pago-completado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
    })

    // Guardar session id en el lead
    await supabaseAdmin
      .from('leads_pago')
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', lead.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return jsonError('Error al crear la sesión de pago', 500, err)
  }
}
```

- [ ] Commit:

```bash
git add app/api/stripe/checkout/route.ts
git commit -m "feat(landing): API route checkout Stripe"
```

---

### Task 4: API route POST /api/stripe/webhook

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

- [ ] Crear `app/api/stripe/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'

// IMPORTANTE: este webhook solo marca el lead como pagado.
// NO crea cuenta de restaurante ni asigna roles. El alta real
// la hace el administrador manualmente desde el panel de leads.
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Sin firma' }, { status: 400 })

  let event: ReturnType<typeof stripe.webhooks.constructEvent> extends Promise<infer T> ? T : ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] firma inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const leadId = session.metadata?.lead_id ?? session.client_reference_id

    if (leadId) {
      // Idempotente: upsert por id, no duplica si llega dos veces
      await supabaseAdmin
        .from('leads_pago')
        .update({
          estado: 'pagado',
          stripe_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .neq('estado', 'pagado') // no sobreescribe si ya estaba pagado
    }
  }

  return NextResponse.json({ received: true })
}

export const config = { api: { bodyParser: false } }
```

- [ ] Commit:

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(landing): webhook Stripe idempotente"
```

---

### Task 5: API route POST /api/contacto

**Files:**
- Create: `app/api/contacto/route.ts`

- [ ] Crear `app/api/contacto/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'

const schema = z.object({
  nombre: z.string().trim().min(1).max(120),
  nombre_restaurante: z.string().trim().min(1).max(120),
  email: z.string().email('Email no válido'),
  telefono: z.string().trim().min(1).max(30),
  mensaje: z.string().max(1000).nullish(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = parseBody(schema, await req.json().catch(() => null))
    if (!parsed.ok) return parsed.response

    const { nombre, nombre_restaurante, email, telefono, mensaje } = parsed.data

    const { error } = await supabaseAdmin
      .from('leads_contacto')
      .insert({ nombre, nombre_restaurante, email, telefono, mensaje: mensaje ?? null })

    if (error) return jsonError('No se pudo enviar el mensaje', 500, error)

    // TODO: enviar notificación por email al equipo de RP cuando se integre un proveedor de email

    return NextResponse.json({ ok: true })
  } catch (err) {
    return jsonError('Error interno', 500, err)
  }
}
```

- [ ] Commit:

```bash
git add app/api/contacto/route.ts
git commit -m "feat(landing): API route formulario de contacto"
```

---

### Task 6: Componentes de la landing — partes estáticas

**Files:**
- Create: `components/landing/Hero.tsx`
- Create: `components/landing/ComoFunciona.tsx`
- Create: `components/landing/Funcionalidades.tsx`
- Create: `components/landing/Footer.tsx`

- [ ] Crear `components/landing/Hero.tsx`:

```tsx
import { PLAN_NOMBRE, PRECIO_MENSUAL } from '@/lib/config/landing'

export default function Hero({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <section className="bg-slate-900 text-white px-4 py-20 text-center">
      <div className="max-w-3xl mx-auto">
        <span className="inline-block bg-amber-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
          TPV · Carta Digital · Verifactu
        </span>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          El sistema todo en uno<br />para tu restaurante
        </h1>
        <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
          Gestiona tu TPV, carta digital, reservas y facturación electrónica desde
          un solo lugar. Sin complicaciones, sin papel, cumpliendo con Hacienda.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onCtaClick}
            className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-8 py-4 rounded-2xl text-lg transition-colors"
          >
            Empieza ahora — {PRECIO_MENSUAL}€/mes
          </button>
          <a
            href="#contacto"
            className="border border-slate-600 hover:border-slate-400 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-colors"
          >
            Solicitar demo
          </a>
        </div>
      </div>
    </section>
  )
}
```

- [ ] Crear `components/landing/ComoFunciona.tsx`:

```tsx
const PASOS = [
  { n: '01', emoji: '📝', titulo: 'Regístrate en 5 minutos', desc: 'Crea tu cuenta, añade tu restaurante y configura el horario. Sin papeleos.' },
  { n: '02', emoji: '🍽️', titulo: 'Configura tu carta y mesas', desc: 'Sube tu menú, crea categorías, asigna mesas y genera el QR para tus clientes.' },
  { n: '03', emoji: '💳', titulo: 'Empieza a cobrar con el TPV', desc: 'Abre comandas, divide cuentas, cobra con tarjeta o efectivo desde cualquier tablet.' },
  { n: '04', emoji: '🧾', titulo: 'Cumple con Hacienda automáticamente', desc: 'Cada ticket genera su registro Verifactu. Sin errores, sin multas, sin estrés.' },
]

export default function ComoFunciona() {
  return (
    <section className="py-20 px-4 bg-white" id="como-funciona">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Cómo funciona</h2>
        <p className="text-slate-500 text-center mb-14">Cuatro pasos para tener tu restaurante digitalizado</p>
        <div className="grid md:grid-cols-2 gap-8">
          {PASOS.map(p => (
            <div key={p.n} className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center text-slate-900 font-bold text-sm">
                {p.n}
              </div>
              <div>
                <div className="text-2xl mb-1">{p.emoji}</div>
                <h3 className="font-bold text-slate-900 mb-1">{p.titulo}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] Crear `components/landing/Funcionalidades.tsx`:

```tsx
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
```

- [ ] Crear `components/landing/Footer.tsx`:

```tsx
import { CONTACTO_EMAIL } from '@/lib/config/landing'

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-10 px-4 text-center text-sm">
      <p className="mb-4 font-semibold text-white">RP Restaurantes</p>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
        <a href="/cliente/demo/privacidad" className="hover:text-white transition-colors">Política de privacidad</a>
        <a href="/cliente/demo/aviso-legal" className="hover:text-white transition-colors">Aviso legal</a>
        <a href="/cliente/demo/cookies" className="hover:text-white transition-colors">Política de cookies</a>
      </div>
      <p>{CONTACTO_EMAIL}</p>
      <p className="mt-4 text-xs text-slate-600">© {new Date().getFullYear()} RP Restaurantes. Todos los derechos reservados.</p>
    </footer>
  )
}
```

- [ ] Commit:

```bash
git add components/landing/
git commit -m "feat(landing): componentes estáticos Hero, ComoFunciona, Funcionalidades, Footer"
```

---

### Task 7: Componente Pricing

**Files:**
- Create: `components/landing/Pricing.tsx`

- [ ] Crear `components/landing/Pricing.tsx`:

```tsx
import { PLAN_NOMBRE, PRECIO_MENSUAL } from '@/lib/config/landing'

const INCLUIDO = [
  'TPV táctil ilimitado',
  'Carta digital con QR',
  'Gestión de reservas con RGPD',
  'Facturación Verifactu automática',
  'Informes y cierre de caja',
  'Soporte por WhatsApp y email',
  'Sin permanencia — cancela cuando quieras',
]

export default function Pricing({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <section className="py-20 px-4 bg-white" id="pricing">
      <div className="max-w-md mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Precio sencillo, sin sorpresas</h2>
        <p className="text-slate-500 text-center mb-12">Un solo plan. Todo incluido.</p>
        <div className="border-2 border-amber-400 rounded-3xl p-8 shadow-lg">
          <p className="text-sm font-bold text-amber-500 uppercase tracking-wide mb-2">{PLAN_NOMBRE}</p>
          <div className="flex items-end gap-1 mb-6">
            <span className="text-5xl font-bold text-slate-900">{PRECIO_MENSUAL}€</span>
            <span className="text-slate-500 mb-2">/mes</span>
          </div>
          <ul className="space-y-3 mb-8">
            {INCLUIDO.map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-amber-400 font-bold mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={onCtaClick}
            className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-2xl text-lg transition-colors"
          >
            Empieza ahora
          </button>
          <p className="text-xs text-slate-400 text-center mt-4">Pago mensual por tarjeta. Cancela en cualquier momento.</p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] Commit:

```bash
git add components/landing/Pricing.tsx
git commit -m "feat(landing): componente Pricing"
```

---

### Task 8: Modal de checkout (Client Component)

**Files:**
- Create: `components/landing/CheckoutModal.tsx`

- [ ] Crear `components/landing/CheckoutModal.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CheckoutModal({ open, onClose }: Props) {
  const [nombre, setNombre] = useState('')
  const [nombreRestaurante, setNombreRestaurante] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  if (!open) return null

  async function handlePagar() {
    setError(null)
    if (!nombre.trim() || !nombreRestaurante.trim() || !email.trim() || !telefono.trim()) {
      setError('Por favor, rellena todos los campos')
      return
    }
    setCargando(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, nombre_restaurante: nombreRestaurante, email, telefono }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al procesar el pago'); setCargando(false); return }
      window.location.href = data.url
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Empezar ahora</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <p className="text-sm text-slate-500 mb-6">Rellena tus datos y te redirigimos a la pasarela de pago segura de Stripe.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del restaurante</label>
            <input
              type="text"
              value={nombreRestaurante}
              onChange={e => setNombreRestaurante(e.target.value)}
              placeholder="Bar / Restaurante"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="+34 600 000 000"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        <button
          onClick={handlePagar}
          disabled={cargando}
          className="w-full mt-6 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-bold py-4 rounded-2xl text-lg transition-colors"
        >
          {cargando ? 'Redirigiendo...' : 'Ir al pago seguro →'}
        </button>
        <p className="text-xs text-slate-400 text-center mt-3">Pago procesado por Stripe. Tus datos están seguros.</p>
      </div>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add components/landing/CheckoutModal.tsx
git commit -m "feat(landing): modal de checkout con formulario pre-Stripe"
```

---

### Task 9: Formulario de contacto/demo (Client Component)

**Files:**
- Create: `components/landing/ContactoForm.tsx`

- [ ] Crear `components/landing/ContactoForm.tsx`:

```tsx
'use client'

import { useState } from 'react'

export default function ContactoForm() {
  const [nombre, setNombre] = useState('')
  const [nombreRestaurante, setNombreRestaurante] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleEnviar() {
    setErrorMsg(null)
    if (!nombre.trim() || !email.trim() || !telefono.trim()) {
      setErrorMsg('Nombre, email y teléfono son obligatorios')
      return
    }
    setEstado('enviando')
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, nombre_restaurante: nombreRestaurante, email, telefono, mensaje: mensaje || null }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Error al enviar'); setEstado('error'); return }
      setEstado('ok')
    } catch {
      setErrorMsg('Error de conexión. Inténtalo de nuevo.')
      setEstado('error')
    }
  }

  if (estado === 'ok') {
    return (
      <div className="max-w-xl mx-auto text-center py-10">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">¡Mensaje recibido!</h3>
        <p className="text-slate-500">Nos pondremos en contacto contigo en menos de 24 horas.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Restaurante</label>
          <input type="text" value={nombreRestaurante} onChange={e => setNombreRestaurante(e.target.value)} placeholder="Nombre del negocio"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono *</label>
          <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+34 600 000 000"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Mensaje (opcional)</label>
        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={4} placeholder="Cuéntanos sobre tu negocio..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
      </div>
      {errorMsg && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMsg}</p>}
      <button onClick={handleEnviar} disabled={estado === 'enviando'}
        className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-bold py-4 rounded-2xl text-lg transition-colors">
        {estado === 'enviando' ? 'Enviando...' : 'Solicitar demo gratuita'}
      </button>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add components/landing/ContactoForm.tsx
git commit -m "feat(landing): formulario de contacto/demo"
```

---

### Task 10: Landing page principal — app/page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] Reemplazar `app/page.tsx` completo:

```tsx
'use client'

import { useState } from 'react'
import Hero from '@/components/landing/Hero'
import ComoFunciona from '@/components/landing/ComoFunciona'
import Funcionalidades from '@/components/landing/Funcionalidades'
import Pricing from '@/components/landing/Pricing'
import ContactoForm from '@/components/landing/ContactoForm'
import Footer from '@/components/landing/Footer'
import CheckoutModal from '@/components/landing/CheckoutModal'

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <Hero onCtaClick={() => setModalOpen(true)} />
      <ComoFunciona />
      <Funcionalidades />
      <Pricing onCtaClick={() => setModalOpen(true)} />
      <section className="py-20 px-4 bg-slate-50" id="contacto">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">¿Hablamos?</h2>
          <p className="text-slate-500 text-center mb-10">Solicita una demo gratuita y te lo enseñamos todo sin compromiso.</p>
          <ContactoForm />
        </div>
      </section>
      <Footer />
      <CheckoutModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
```

- [ ] Commit:

```bash
git add app/page.tsx
git commit -m "feat(landing): página principal con todas las secciones"
```

---

### Task 11: Página de retorno post-pago

**Files:**
- Create: `app/pago-completado/page.tsx`

- [ ] Crear `app/pago-completado/page.tsx`:

```tsx
export default function PagoCompletado() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-10 text-center">
        <div className="text-5xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">¡Pago completado!</h1>
        <p className="text-slate-600 leading-relaxed mb-6">
          Hemos recibido tu suscripción. En breve nos pondremos en contacto contigo
          por email o teléfono para activar tu cuenta y ayudarte con la configuración inicial.
        </p>
        <p className="text-sm text-slate-400 mb-8">
          Si tienes cualquier duda, escríbenos a{' '}
          <a href="mailto:hola@rp-restaurantes.com" className="text-amber-500 underline">
            hola@rp-restaurantes.com
          </a>
        </p>
        <a href="/" className="inline-block bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-8 py-3 rounded-2xl transition-colors">
          Volver al inicio
        </a>
      </div>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/pago-completado/page.tsx
git commit -m "feat(landing): página de confirmación post-pago"
```

---

### Task 12: Panel de leads /admin/leads

**Files:**
- Create: `app/admin/leads/page.tsx`
- Create: `app/admin/leads/LeadsView.tsx`

- [ ] Crear `app/admin/leads/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import LeadsView from './LeadsView'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const roles = userRecord?.user_roles as unknown as { roles: { name: string } | null }[]
  const isAdmin = roles?.some(r => r.roles?.name === 'superadmin' || r.roles?.name === 'admin') ?? false
  if (!isAdmin) redirect('/login')

  const [{ data: leadsPago }, { data: leadsContacto }] = await Promise.all([
    supabaseAdmin.from('leads_pago').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('leads_contacto').select('*').order('created_at', { ascending: false }),
  ])

  return <LeadsView leadsPago={leadsPago ?? []} leadsContacto={leadsContacto ?? []} />
}
```

- [ ] Crear `app/admin/leads/LeadsView.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface LeadPago {
  id: string; nombre: string; nombre_restaurante: string; email: string
  telefono: string; estado: string; created_at: string; stripe_session_id: string | null
}
interface LeadContacto {
  id: string; nombre: string; nombre_restaurante: string; email: string
  telefono: string; mensaje: string | null; atendido: boolean; created_at: string
}

const ESTADO_COLOR: Record<string, string> = {
  iniciado: 'bg-yellow-100 text-yellow-700',
  pagado: 'bg-green-100 text-green-700',
  fallido: 'bg-red-100 text-red-700',
}

export default function LeadsView({ leadsPago, leadsContacto }: { leadsPago: LeadPago[], leadsContacto: LeadContacto[] }) {
  const [tab, setTab] = useState<'pago' | 'contacto'>('pago')

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Panel de leads</h1>
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('pago')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'pago' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            Leads de pago ({leadsPago.length})
          </button>
          <button onClick={() => setTab('contacto')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'contacto' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            Solicitudes de demo ({leadsContacto.length})
          </button>
        </div>

        {tab === 'pago' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  {['Nombre', 'Restaurante', 'Email', 'Teléfono', 'Estado', 'Fecha'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadsPago.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{l.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{l.nombre_restaurante}</td>
                    <td className="px-4 py-3 text-slate-600">{l.email}</td>
                    <td className="px-4 py-3 text-slate-600">{l.telefono}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${ESTADO_COLOR[l.estado] ?? ''}`}>{l.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(l.created_at).toLocaleDateString('es-ES')}</td>
                  </tr>
                ))}
                {leadsPago.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin leads todavía</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'contacto' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  {['Nombre', 'Restaurante', 'Email', 'Teléfono', 'Mensaje', 'Atendido', 'Fecha'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadsContacto.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{l.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{l.nombre_restaurante}</td>
                    <td className="px-4 py-3 text-slate-600">{l.email}</td>
                    <td className="px-4 py-3 text-slate-600">{l.telefono}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{l.mensaje ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${l.atendido ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {l.atendido ? 'Sí' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(l.created_at).toLocaleDateString('es-ES')}</td>
                  </tr>
                ))}
                {leadsContacto.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin solicitudes todavía</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add app/admin/leads/
git commit -m "feat(landing): panel de leads /admin/leads protegido por rol"
```

---

### Task 13: Verificación de tipos y build

- [ ] Ejecutar type check:

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] Si hay errores, corregirlos antes de continuar.

- [ ] Commit final:

```bash
git add -A
git commit -m "feat(landing): landing pública completa con Stripe, contacto y panel de leads"
```
