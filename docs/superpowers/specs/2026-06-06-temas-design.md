# Sistema de Temas — Diseño

**Fecha:** 2026-06-06  
**Estado:** Aprobado

## Resumen

Implementar un sistema de temas visuales con 3 paletas de color × 2 modos (claro/oscuro), seleccionable desde una página de Configuración y guardado por usuario en Supabase.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Tipo de personalización | Temas prediseñados (sin editor libre) |
| Temas | Slate, Ocean, Sunset |
| Modos | Claro y Oscuro |
| Combinaciones totales | 6 (3 temas × 2 modos) |
| Ubicación del selector | Solo en `Dashboard → Configuración → Apariencia` |
| Almacenamiento | Supabase — columna `theme` en `public.users` |
| Sincronización | Por usuario, todos los dispositivos |

## Paletas de color

### Slate (actual)
| Token | Claro | Oscuro |
|---|---|---|
| `--primary` | `#0f172a` | `#0f172a` |
| `--primary-hover` | `#1e293b` | `#1e293b` |
| `--bg-page` | `#f4f6f9` | `#0f172a` |
| `--bg-surface` | `#ffffff` | `#1e293b` |
| `--bg-surface-hover` | `#f8fafc` | `#334155` |
| `--text-primary` | `#0f172a` | `#f8fafc` |
| `--text-secondary` | `#64748b` | `#94a3b8` |
| `--border` | `#e2e8f0` | `#334155` |

### Ocean (azul)
| Token | Claro | Oscuro |
|---|---|---|
| `--primary` | `#1d4ed8` | `#1d4ed8` |
| `--primary-hover` | `#1e40af` | `#1e40af` |
| `--bg-page` | `#eff6ff` | `#0f172a` |
| `--bg-surface` | `#ffffff` | `#1e3a5f` |
| `--bg-surface-hover` | `#dbeafe` | `#1e40af` |
| `--text-primary` | `#1e3a8a` | `#bfdbfe` |
| `--text-secondary` | `#3b82f6` | `#93c5fd` |
| `--border` | `#bfdbfe` | `#1d4ed8` |

### Sunset (naranja)
| Token | Claro | Oscuro |
|---|---|---|
| `--primary` | `#c2410c` | `#c2410c` |
| `--primary-hover` | `#9a3412` | `#9a3412` |
| `--bg-page` | `#fff7ed` | `#0c0a09` |
| `--bg-surface` | `#ffffff` | `#1c1917` |
| `--bg-surface-hover` | `#ffedd5` | `#292524` |
| `--text-primary` | `#7c2d12` | `#fed7aa` |
| `--text-secondary` | `#ea580c` | `#fb923c` |
| `--border` | `#fed7aa` | `#431407` |

## Arquitectura

### Base de datos
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'slate-light';
```
Valores válidos: `slate-light`, `slate-dark`, `ocean-light`, `ocean-dark`, `sunset-light`, `sunset-dark`.

### CSS (`app/globals.css`)
Variables CSS definidas por selector `[data-theme="..."]` en `:root`. El tema se aplica como atributo `data-theme` en el elemento `<html>`.

### Layout (`app/layout.tsx`)
Server component que:
1. Lee el usuario autenticado de Supabase
2. Lee `users.theme` del usuario actual
3. Aplica `<html data-theme={theme}>` para SSR sin flash

### Componentes a modificar
Todos los componentes que usan colores hardcodeados deben migrar a variables CSS:

| Clase Tailwind actual | Reemplazo |
|---|---|
| `bg-[#0f172a]` | `bg-[var(--primary)]` |
| `hover:bg-[#1e293b]` | `hover:bg-[var(--primary-hover)]` |
| `bg-[#f4f6f9]`, `bg-[#f8fafc]` | `bg-[var(--bg-page)]` |
| `bg-white` | `bg-[var(--bg-surface)]` |
| `text-[#0f172a]` | `text-[var(--text-primary)]` |
| `text-[#64748b]` | `text-[var(--text-secondary)]` |
| `border-[#e2e8f0]` | `border-[var(--border)]` |

### Nuevos archivos

- `app/actions/tema.ts` — server action `guardarTema(tema: string)`
- `app/dashboard/configuracion/page.tsx` — página de configuración con pestaña Apariencia
- `components/configuracion/AparienciaPanel.tsx` — selector visual de tema + modo

### Flujo de cambio de tema
1. Usuario selecciona tema en `AparienciaPanel`
2. `AparienciaPanel` llama a `guardarTema(tema)` (server action)
3. Server action actualiza `users.theme` en Supabase y hace `revalidatePath('/dashboard/configuracion')`
4. Next.js re-renderiza con el nuevo `data-theme` en `<html>`

## Archivos afectados (migración de colores)

- `components/AppShell.tsx`
- `components/tpv/TableMap.tsx`, `OrderPanel.tsx`, `OrderView.tsx`
- `components/productos/AddProductPanel.tsx`, `EditProductModal.tsx`, `ProductRow.tsx`
- `components/equipo/EquipoClient.tsx`
- `components/carta/MenuItemFormPanel.tsx`
- `app/dashboard/page.tsx`
- `app/tpv/cobro/[orderId]/page.tsx`
- `app/tpv/comanda/[orderId]/page.tsx`
- `app/dashboard/finanzas/page.tsx`
- `app/dashboard/equipo/page.tsx`

### globals.css
La regla `input, select, textarea { color: #0f172a !important; }` debe cambiar a `color: var(--text-primary) !important;`.

## Fuera de alcance
- Editor de colores libre (sin picker personalizado)
- Temas por restaurante (es por usuario)
- Temas adicionales más allá de Slate, Ocean, Sunset
