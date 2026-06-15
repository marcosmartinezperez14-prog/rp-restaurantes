# Integración Verifactu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar la API de Verifacti para emitir facturas simplificadas (F2) y normales (F1) desde tickets de TPV, guardando la respuesta en la tabla `tickets` de Supabase.

**Architecture:** Un módulo de servicio puro (`lib/verifacti/client.ts`) contiene la lógica de construcción del payload y la llamada HTTP a Verifacti. Una API Route del servidor (`app/api/verifactu/enviar/route.ts`) orquesta: leer el ticket, llamar al servicio y persistir la respuesta. Un hook React (`hooks/useVerifactu.ts`) encapsula el fetch a la API Route. Un componente `BotonVerifactu` consume el hook y muestra el estado. La API key nunca sale del servidor.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (createClient server), Tailwind CSS

---

## CRÍTICO: Patrones del codebase

- API routes: `import { createClient } from '@/lib/supabase/server'` (async, usa cookies)
- Admin DB: `import { supabaseAdmin } from '@/lib/supabase/admin'` (service role, sin RLS)
- Hooks cliente: `'use client'` + `useState` + `useCallback`, sin acceso a Supabase directamente
- Componentes: `'use client'`, Tailwind, sin `<a>` — usar `onClick={() => window.open(url, '_blank')}`
- Variables de servidor: sin prefijo `NEXT_PUBLIC_`

## Formato tax_breakdown esperado en la tabla tickets

El campo `tax_breakdown` (JSONB) se asume como array de objetos:
```json
[
  { "tipo_impositivo": 21, "base_imponible": 200.00, "cuota_repercutida": 42.00 },
  { "tipo_impositivo": 10, "base_imponible": 50.00,  "cuota_repercutida": 5.00  }
]
```
Si es null o array vacío, se genera una línea única usando `subtotal` y `tax_total` del ticket con tipo impositivo calculado.

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|---|---|---|
| CREAR | `types/verifactu.ts` | Tipos TS: payload, respuesta, ticket |
| CREAR | `lib/verifacti/client.ts` | buildPayload, sendToVerifacti, updateTicketVerifactu |
| CREAR | `app/api/verifactu/enviar/route.ts` | POST route — orquesta lectura, envío y persistencia |
| CREAR | `hooks/useVerifactu.ts` | Hook React con enviarFactura, loading, error, resultado |
| CREAR | `components/verifactu/BotonVerifactu.tsx` | Botón/badge de estado Verifactu |

---

## Task 1: Tipos TypeScript

**Archivos:**
- Crear: `types/verifactu.ts`

- [ ] **Step 1: Crear types/verifactu.ts**

```typescript
export interface TaxBreakdownItem {
  tipo_impositivo: number
  base_imponible: number
  cuota_repercutida: number
}

export interface TicketVerifactu {
  id: string
  series: string
  sequential_number: number
  total: number
  subtotal: number
  tax_total: number
  tax_breakdown: TaxBreakdownItem[] | null
  issued_at: string
  issuer_nif: string | null
  verifactu_hash: string | null
  verifactu_status: string | null
  verifactu_response: object | null
  verifactu_sent_at: string | null
  verifactu_prev_hash: string | null
}

export interface VerifactiLinea {
  base_imponible: string
  tipo_impositivo: string
  cuota_repercutida: string
}

export interface VerifactiPayload {
  serie: string
  numero: string
  fecha_expedicion: string   // "DD-MM-YYYY"
  tipo_factura: 'F1' | 'F2'
  descripcion: string
  nif?: string
  nombre?: string
  lineas: VerifactiLinea[]
  importe_total: string
}

export interface VerifactiRespuesta {
  uuid: string
  estado: string
  url: string
  qr: string
  huella: string
}

export interface EnviarFacturaOpciones {
  tipoFactura: 'F1' | 'F2'
  clienteNif?: string
  clienteNombre?: string
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "verifactu"
```

Sin errores.

- [ ] **Step 3: Commit**

```powershell
git add types/verifactu.ts
git commit -m "feat: tipos TypeScript para integración Verifactu"
```

---

## Task 2: Servicio lib/verifacti/client.ts

**Archivos:**
- Crear: `lib/verifacti/client.ts`

- [ ] **Step 1: Crear lib/verifacti/client.ts**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  TicketVerifactu,
  VerifactiLinea,
  VerifactiPayload,
  VerifactiRespuesta,
  TaxBreakdownItem,
} from '@/types/verifactu'

const VERIFACTI_BASE_URL = 'https://api.verifacti.com'

function formatFecha(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function buildLineas(ticket: TicketVerifactu): VerifactiLinea[] {
  const breakdown: TaxBreakdownItem[] =
    Array.isArray(ticket.tax_breakdown) && ticket.tax_breakdown.length > 0
      ? ticket.tax_breakdown
      : [{
          tipo_impositivo: ticket.tax_total > 0
            ? Math.round((ticket.tax_total / ticket.subtotal) * 100)
            : 21,
          base_imponible: ticket.subtotal,
          cuota_repercutida: ticket.tax_total,
        }]

  return breakdown.map(item => ({
    base_imponible:     String(Number(item.base_imponible).toFixed(2)),
    tipo_impositivo:    String(item.tipo_impositivo),
    cuota_repercutida:  String(Number(item.cuota_repercutida).toFixed(2)),
  }))
}

export function buildPayload(
  ticket: TicketVerifactu,
  tipoFactura: 'F1' | 'F2',
  clienteNif?: string,
  clienteNombre?: string,
): VerifactiPayload {
  const payload: VerifactiPayload = {
    serie:            ticket.series || 'A',
    numero:           String(ticket.sequential_number),
    fecha_expedicion: formatFecha(ticket.issued_at),
    tipo_factura:     tipoFactura,
    descripcion:      tipoFactura === 'F1' ? 'Factura normal' : 'Factura simplificada',
    lineas:           buildLineas(ticket),
    importe_total:    String(Number(ticket.total).toFixed(2)),
  }

  if (tipoFactura === 'F1') {
    payload.nif    = clienteNif
    payload.nombre = clienteNombre
  }

  return payload
}

export async function sendToVerifacti(payload: VerifactiPayload): Promise<VerifactiRespuesta> {
  const apiKey = process.env.VERIFACTI_API_KEY
  if (!apiKey) throw new Error('VERIFACTI_API_KEY no configurada')

  const res = await fetch(`${VERIFACTI_BASE_URL}/verifactu/create`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Verifacti ${res.status}: ${text}`)
  }

  return res.json() as Promise<VerifactiRespuesta>
}

export async function updateTicketVerifactu(
  supabase: SupabaseClient,
  ticketId: string,
  respuesta: VerifactiRespuesta,
): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({
      verifactu_hash:     respuesta.huella,
      verifactu_status:   respuesta.estado,
      verifactu_response: respuesta,
      verifactu_sent_at:  new Date().toISOString(),
    })
    .eq('id', ticketId)

  if (error) throw new Error(`Error al actualizar ticket: ${error.message}`)
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "verifact"
```

Sin errores.

- [ ] **Step 3: Commit**

```powershell
git add lib/verifacti/client.ts
git commit -m "feat: servicio Verifacti — buildPayload, sendToVerifacti, updateTicketVerifactu"
```

---

## Task 3: API Route POST /api/verifactu/enviar

**Archivos:**
- Crear: `app/api/verifactu/enviar/route.ts`

- [ ] **Step 1: Crear app/api/verifactu/enviar/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPayload, sendToVerifacti, updateTicketVerifactu } from '@/lib/verifacti/client'
import type { TicketVerifactu, EnviarFacturaOpciones } from '@/types/verifactu'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { ticketId?: string } & Partial<EnviarFacturaOpciones>
  const { ticketId, tipoFactura = 'F2', clienteNif, clienteNombre } = body

  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId es obligatorio' }, { status: 400 })
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select(
      'id, series, sequential_number, total, subtotal, tax_total, tax_breakdown, issued_at, issuer_nif, verifactu_hash, verifactu_status, verifactu_response, verifactu_sent_at, verifactu_prev_hash'
    )
    .eq('id', ticketId)
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
  }

  try {
    const payload = buildPayload(
      ticket as TicketVerifactu,
      tipoFactura,
      clienteNif,
      clienteNombre,
    )

    const respuesta = await sendToVerifacti(payload)
    await updateTicketVerifactu(supabase, ticketId, respuesta)

    return NextResponse.json({ ok: true, data: respuesta })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: mensaje }, { status: 502 })
  }
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "verifact"
```

Sin errores.

- [ ] **Step 3: Commit**

```powershell
git add app/api/verifactu/enviar/route.ts
git commit -m "feat: API route POST /api/verifactu/enviar"
```

---

## Task 4: Hook useVerifactu

**Archivos:**
- Crear: `hooks/useVerifactu.ts`

- [ ] **Step 1: Crear hooks/useVerifactu.ts**

```typescript
'use client'

import { useState, useCallback } from 'react'
import type { VerifactiRespuesta, EnviarFacturaOpciones } from '@/types/verifactu'

interface EstadoVerifactu {
  loading: boolean
  error: string | null
  resultado: VerifactiRespuesta | null
}

export function useVerifactu() {
  const [estado, setEstado] = useState<EstadoVerifactu>({
    loading: false,
    error:   null,
    resultado: null,
  })

  const enviarFactura = useCallback(async (
    ticketId: string,
    opciones: EnviarFacturaOpciones = { tipoFactura: 'F2' },
  ) => {
    setEstado({ loading: true, error: null, resultado: null })

    try {
      const res = await fetch('/api/verifactu/enviar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticketId, ...opciones }),
      })

      const json = await res.json() as { ok?: boolean; data?: VerifactiRespuesta; error?: string }

      if (!res.ok || json.error) {
        setEstado({ loading: false, error: json.error ?? 'Error al enviar', resultado: null })
        return null
      }

      setEstado({ loading: false, error: null, resultado: json.data ?? null })
      return json.data ?? null
    } catch {
      setEstado({ loading: false, error: 'Error de conexión', resultado: null })
      return null
    }
  }, [])

  return { ...estado, enviarFactura }
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "verifact"
```

Sin errores.

- [ ] **Step 3: Commit**

```powershell
git add hooks/useVerifactu.ts
git commit -m "feat: hook useVerifactu con enviarFactura, loading, error, resultado"
```

---

## Task 5: Componente BotonVerifactu

**Archivos:**
- Crear: `components/verifactu/BotonVerifactu.tsx`

- [ ] **Step 1: Crear components/verifactu/BotonVerifactu.tsx**

```typescript
'use client'

import { useVerifactu } from '@/hooks/useVerifactu'
import type { EnviarFacturaOpciones } from '@/types/verifactu'

interface Props {
  ticketId: string
  verifactuStatus: string | null | undefined
  verifactuUrl: string | null | undefined
  opciones?: EnviarFacturaOpciones
}

export default function BotonVerifactu({
  ticketId,
  verifactuStatus,
  verifactuUrl,
  opciones = { tipoFactura: 'F2' },
}: Props) {
  const { loading, error, resultado, enviarFactura } = useVerifactu()

  const estadoActual = resultado?.estado ?? verifactuStatus ?? null
  const urlActual    = resultado?.url    ?? verifactuUrl    ?? null
  const yaEnviado    = estadoActual === 'Pendiente' || estadoActual === 'Correcto'

  function handleEnviar() {
    enviarFactura(ticketId, opciones)
  }

  function handleVerQR() {
    if (urlActual) window.open(urlActual, '_blank', 'noopener,noreferrer')
  }

  // Estado: enviado correctamente
  if (yaEnviado) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-sm font-semibold">
          <span>✓</span>
          <span>Enviado a Verifactu</span>
        </span>
        {urlActual && (
          <button
            onClick={handleVerQR}
            className="text-sm px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
          >
            Ver en AEAT
          </button>
        )}
      </div>
    )
  }

  // Estado: error
  if (error) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-semibold">
          <span>✕</span>
          <span>Error Verifactu</span>
        </span>
        <button
          onClick={handleEnviar}
          disabled={loading}
          className="text-sm px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Reintentar
        </button>
        <span className="text-xs text-red-500 w-full">{error}</span>
      </div>
    )
  }

  // Estado: pendiente de envío
  return (
    <button
      onClick={handleEnviar}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Enviando...</span>
        </>
      ) : (
        <>
          <span>📄</span>
          <span>Enviar a Verifactu</span>
        </>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "verifact"
```

Sin errores.

- [ ] **Step 3: Commit**

```powershell
git add components/verifactu/BotonVerifactu.tsx
git commit -m "feat: BotonVerifactu — botón/badge de estado con spinner y reintentar"
```

---

## Task 6: Variable de entorno + build final

**Archivos:**
- Modificar: `.env.local` (añadir clave)

- [ ] **Step 1: Añadir VERIFACTI_API_KEY a .env.local**

Abrir `.env.local` y añadir al final:

```
VERIFACTI_API_KEY=tu_api_key_de_verifacti
```

Sustituir `tu_api_key_de_verifacti` por el valor real. Esta variable **nunca** debe ir a `.env.example` ni al repositorio si contiene el valor real.

- [ ] **Step 2: Build completo**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run build 2>&1 | Select-Object -Last 20
```

Resultado esperado: `✓ Compiled successfully` sin errores TypeScript.

- [ ] **Step 3: Push**

```powershell
git push origin master 2>&1
```

---

## Self-Review

**Spec coverage:**
- ✅ `buildPayload` con fecha DD-MM-YYYY, numero = sequential_number, tipo_factura F1/F2, nif/nombre solo en F1
- ✅ Múltiples líneas en `lineas` si tax_breakdown tiene múltiples entradas; fallback a línea única con subtotal/tax_total
- ✅ `sendToVerifacti` con Bearer token desde variable de servidor, throws en error HTTP
- ✅ `updateTicketVerifactu` escribe huella, estado, respuesta completa y sent_at
- ✅ API Route: auth guard → 404 si no hay ticket → 502 si Verifacti falla → 200 con respuesta
- ✅ Hook: loading/error/resultado, useCallback, sin acceso directo a Supabase
- ✅ BotonVerifactu: estado null/vacío → botón azul; Pendiente/Correcto → badge verde + Ver en AEAT; error → badge rojo + reintentar; spinner durante envío
- ✅ Sin `<a>` — window.open en onClick
- ✅ VERIFACTI_API_KEY solo en servidor, nunca en cliente
- ✅ No se modifican módulos existentes

**Placeholder scan:** ninguno — todo el código está completo con tipos concretos.

**Type consistency:**
- `VerifactiRespuesta` definida en Task 1, usada en Tasks 2, 3, 4, 5
- `EnviarFacturaOpciones` definida en Task 1, usada en Tasks 3, 4, 5
- `TicketVerifactu` definida en Task 1, usada en Tasks 2, 3
- `TaxBreakdownItem` definida en Task 1, usada en Task 2
- `buildPayload(ticket, tipoFactura, clienteNif?, clienteNombre?)` — firma consistente Tasks 2 y 3
- `enviarFactura(ticketId, opciones)` — firma consistente Tasks 4 y 5
