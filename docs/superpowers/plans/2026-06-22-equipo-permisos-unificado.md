# Equipo + Permisos Unificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar la sección Equipo y Permisos en una sola página con tabs, y hacer que el selector de roles en los modales "Añadir / Cambiar usuario" use los roles creados dinámicamente en Permisos.

**Architecture:** Se añaden helpers de color/label para roles dinámicos en `EquipoClient`, se hace fetch de `/api/permisos/rol` al montar para construir `rolesDisponibles`, se añade estado de tab (`'equipo' | 'permisos'`) que renderiza el grid de usuarios o `ConfiguracionPermisos`, y la página `/dashboard/permisos` pasa a ser un redirect.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS

## Global Constraints

- Seguir los patrones del codebase: `var(--bg-surface)`, `var(--border)`, `var(--text-primary/secondary)`, `var(--accent)`, `var(--primary)`
- Los inputs/selects deben tener `text-black` (ver memoria: form text color must be black)
- No TypeScript `any`. Usar `unknown` con cast explícito cuando sea necesario.
- No crear archivos nuevos salvo los indicados. No comentarios innecesarios.

---

### Task 1: Soporte de tipos para roles dinámicos

**Files:**
- Modify: `types/equipo.ts`
- Modify: `components/equipo/EquipoClient.tsx` (solo helpers y accesos a COLOR_ROL / PERMISOS_POR_ROL)

**Interfaces:**
- Produces: `UsuarioEquipo.rol: string` (antes `RolNombre`), helpers `getColorRol(rol: string)` y `getRolLabel(rol: string)` y `getRolDescripcion(rol: string)` disponibles en `EquipoClient`

- [ ] **Step 1: Cambiar `UsuarioEquipo.rol` de `RolNombre` a `string` en `types/equipo.ts`**

Sustituir la línea:
```ts
rol: RolNombre
```
por:
```ts
rol: string
```

- [ ] **Step 2: Añadir helpers de color/label en `EquipoClient.tsx` justo después de `MODULOS_LABELS`**

```tsx
const FALLBACK_COLOR = { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700', avatar: 'bg-gray-200 text-gray-800' }

function getColorRol(rol: string) {
  return COLOR_ROL[rol as RolNombre] ?? FALLBACK_COLOR
}

function getRolLabel(rol: string): string {
  return PERMISOS_POR_ROL[rol as RolNombre]?.label ?? (rol.charAt(0).toUpperCase() + rol.slice(1))
}

function getRolDescripcion(rol: string): string {
  return PERMISOS_POR_ROL[rol as RolNombre]?.descripcion ?? ''
}
```

- [ ] **Step 3: Reemplazar accesos directos a `COLOR_ROL` y `PERMISOS_POR_ROL` en el render del grid**

En el render de tarjetas (dentro del `.map((usuario) => {`), buscar:
```tsx
const colores = COLOR_ROL[usuario.rol]
```
y cambiar por:
```tsx
const colores = getColorRol(usuario.rol)
```

Buscar:
```tsx
{PERMISOS_POR_ROL[usuario.rol].label}
```
y cambiar por:
```tsx
{getRolLabel(usuario.rol)}
```

Buscar:
```tsx
<p className="text-xs text-[var(--text-secondary)]">{PERMISOS_POR_ROL[usuario.rol].descripcion}</p>
```
y cambiar por:
```tsx
<p className="text-xs text-[var(--text-secondary)]">{getRolDescripcion(usuario.rol)}</p>
```

En `ModalCambiarRol`, en el toast de éxito, buscar:
```tsx
mostrarToast(`Rol de ${usuario.nombre} actualizado a ${PERMISOS_POR_ROL[rolSeleccionado].label}`, 'exito')
```
y cambiar por:
```tsx
mostrarToast(`Rol de ${usuario.nombre} actualizado a ${getRolLabel(rolSeleccionado)}`, 'exito')
```

- [ ] **Step 4: Verificar que compila sin errores**

```bash
npx tsc --noEmit
```
Expected: sin errores de tipo relacionados con `rol`.

- [ ] **Step 5: Commit**

```bash
git add types/equipo.ts components/equipo/EquipoClient.tsx
git commit -m "refactor(equipo): soporte de roles dinámicos en tipos y helpers de display"
```

---

### Task 2: Fetch de roles dinámicos y actualización de modales

**Files:**
- Modify: `components/equipo/EquipoClient.tsx`

**Interfaces:**
- Consumes: `GET /api/permisos/rol` → `{ data: MatrizPermisos[] }` donde `MatrizPermisos = { role_id: string, role_name: string, restaurant_id: string | null, permisos: {...} }`
- Consumes: `ROLES_PROTEGIDOS = ['admin']` y `ROLES_OCULTOS = ['superadmin']` de `@/lib/permisos/modulos`
- Produces: `rolesDisponibles: Array<{role_id: string, role_name: string}>` accesible por los modales vía closure

- [ ] **Step 1: Añadir import de constantes de filtrado al inicio de `EquipoClient.tsx`**

Buscar la línea:
```tsx
import { RolNombre, UsuarioEquipo, PERMISOS_POR_ROL } from '@/types/equipo'
```
y añadir debajo:
```tsx
import { ROLES_PROTEGIDOS, ROLES_OCULTOS } from '@/lib/permisos/modulos'
import type { MatrizPermisos } from '@/types/permisos'
```

- [ ] **Step 2: Añadir estado `rolesDisponibles` al componente principal**

Justo después de la línea `const [cargando, setCargando] = useState(false)`, añadir:
```tsx
const [rolesDisponibles, setRolesDisponibles] = useState<Array<{role_id: string, role_name: string}>>([])
```

- [ ] **Step 3: Fetch de roles al montar el componente**

Añadir un `useEffect` después del estado anterior (requiere que `useState` ya esté importado — ya lo está):

```tsx
useEffect(() => {
  fetch('/api/permisos/rol')
    .then(r => r.json())
    .then(data => {
      const lista = (data.data as MatrizPermisos[])
        .filter(r => !ROLES_PROTEGIDOS.includes(r.role_name) && !ROLES_OCULTOS.includes(r.role_name))
        .map(r => ({ role_id: r.role_id, role_name: r.role_name }))
      setRolesDisponibles(lista)
    })
    .catch(() => {/* silencioso: los modales muestran lista vacía o fallback */})
}, [])
```

- [ ] **Step 4: Actualizar `ModalAnadirUsuario` para usar `rolesDisponibles`**

Cambiar el estado inicial del rol:
```tsx
const [rolSeleccionado, setRolSeleccionado] = useState<string>('camarero')
```

Reemplazar el bloque `<select>` de roles (el que itera `ROLES_LISTA`):
```tsx
<select
  value={rolSeleccionado}
  onChange={(e) => setRolSeleccionado(e.target.value)}
  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
>
  {rolesDisponibles.map((r) => (
    <option key={r.role_id} value={r.role_name}>
      {getRolLabel(r.role_name)}{getRolDescripcion(r.role_name) ? ` — ${getRolDescripcion(r.role_name)}` : ''}
    </option>
  ))}
</select>
```

Reemplazar el panel de módulos (el bloque `<div className={... COLOR_ROL[rolSeleccionado].bg ...}>` con los módulos) por uno que solo se muestre si el rol está en `PERMISOS_POR_ROL`:

```tsx
{PERMISOS_POR_ROL[rolSeleccionado as RolNombre] && (
  <div className={`mt-2 rounded-lg p-3 ${getColorRol(rolSeleccionado).bg}`}>
    <p className={`text-xs font-medium mb-2 ${getColorRol(rolSeleccionado).text}`}>
      Módulos con acceso:
    </p>
    <div className="flex flex-wrap gap-1">
      {PERMISOS_POR_ROL[rolSeleccionado as RolNombre].modulos.map((m) => (
        <span key={m} className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {MODULOS_LABELS[m] ?? m}
        </span>
      ))}
    </div>
  </div>
)}
```

También cambiar el body del fetch en `handleGuardar`:
```tsx
body: JSON.stringify({ username: username.trim(), nombre: nombre.trim(), password, role_name: rolSeleccionado }),
```
(ya usa `rolSeleccionado` directamente, no necesita cast)

- [ ] **Step 5: Actualizar `ModalCambiarRol` para usar `rolesDisponibles`**

Cambiar el estado inicial:
```tsx
const [rolSeleccionado, setRolSeleccionado] = useState<string>(usuario.rol)
```

Reemplazar el `<select>` de roles (el que itera `ROLES_LISTA`):
```tsx
<select
  value={rolSeleccionado}
  onChange={(e) => setRolSeleccionado(e.target.value)}
  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
>
  {rolesDisponibles.map((r) => (
    <option key={r.role_id} value={r.role_name}>
      {getRolLabel(r.role_name)}
    </option>
  ))}
</select>
```

Reemplazar el panel de descripción/módulos:
```tsx
<div className={`mt-2 rounded-lg p-3 ${getColorRol(rolSeleccionado).bg}`}>
  <p className={`text-xs font-medium ${getColorRol(rolSeleccionado).text}`}>
    {getRolDescripcion(rolSeleccionado) || getRolLabel(rolSeleccionado)}
  </p>
  {PERMISOS_POR_ROL[rolSeleccionado as RolNombre] && (
    <div className="flex flex-wrap gap-1 mt-2">
      {PERMISOS_POR_ROL[rolSeleccionado as RolNombre].modulos.map((m) => (
        <span key={m} className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {MODULOS_LABELS[m] ?? m}
        </span>
      ))}
    </div>
  )}
</div>
```

En `handleGuardar`, la comparación de igualdad ya usa `rolSeleccionado === usuario.rol` — correcto.

- [ ] **Step 6: Verificar compilación y eliminar `ROLES_LISTA` si ya no se usa**

```bash
npx tsc --noEmit
```

Si `ROLES_LISTA` ya no se referencia en el archivo, eliminar la línea:
```tsx
const ROLES_LISTA: RolNombre[] = ['admin', 'gerente', 'camarero', 'cocinero', 'contable']
```

- [ ] **Step 7: Commit**

```bash
git add components/equipo/EquipoClient.tsx
git commit -m "feat(equipo): roles dinámicos en modales añadir y cambiar usuario"
```

---

### Task 3: Tabs Equipo / Permisos en EquipoClient

**Files:**
- Modify: `components/equipo/EquipoClient.tsx`
- Modify: `app/dashboard/equipo/page.tsx` (añadir prop `rolUsuarioActual`)

**Interfaces:**
- Consumes: `ConfiguracionPermisos` de `@/components/permisos/ConfiguracionPermisos` con prop `rolUsuarioActual: 'admin' | 'gerente'`
- Produces: `EquipoClient` acepta nueva prop `rolUsuarioActual: 'admin' | 'gerente' | null`

- [ ] **Step 1: Añadir import de `ConfiguracionPermisos` en `EquipoClient.tsx`**

Añadir al bloque de imports:
```tsx
import ConfiguracionPermisos from '@/components/permisos/ConfiguracionPermisos'
```

- [ ] **Step 2: Añadir prop `rolUsuarioActual` a la interfaz `Props`**

Cambiar:
```tsx
interface Props {
  usuarios: UsuarioEquipo[]
  rolActual: RolNombre
  usuarioActualId: string
  restaurantId: string
}
```
por:
```tsx
interface Props {
  usuarios: UsuarioEquipo[]
  rolActual: RolNombre
  usuarioActualId: string
  restaurantId: string
  rolUsuarioActual: 'admin' | 'gerente' | null
}
```

- [ ] **Step 3: Añadir estado de tab al componente**

Añadir junto a los demás estados:
```tsx
const [tabActiva, setTabActiva] = useState<'equipo' | 'permisos'>('equipo')
```

- [ ] **Step 4: Actualizar la firma del componente para recibir la nueva prop**

Cambiar:
```tsx
export default function EquipoClient({ usuarios: usuariosIniciales, rolActual, usuarioActualId }: Props) {
```
por:
```tsx
export default function EquipoClient({ usuarios: usuariosIniciales, rolActual, usuarioActualId, rolUsuarioActual }: Props) {
```

- [ ] **Step 5: Reemplazar el render principal del componente**

Localizar el bloque `return (` del componente principal. Reemplazar desde `<div className="max-w-5xl mx-auto">` hasta el `</div>` final por:

```tsx
<div className="max-w-5xl mx-auto">
  {/* Tabs */}
  {puedeGestionar && (
    <div className="flex gap-1 border-b border-[var(--border)] mb-6">
      <button
        onClick={() => setTabActiva('equipo')}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
          tabActiva === 'equipo'
            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        Equipo
      </button>
      <button
        onClick={() => setTabActiva('permisos')}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
          tabActiva === 'permisos'
            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        Permisos
      </button>
    </div>
  )}

  {tabActiva === 'equipo' && (
    <>
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Equipo</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{usuarios.length} {usuarios.length === 1 ? 'miembro' : 'miembros'}</p>
        </div>
        {puedeGestionar && (
          <button
            onClick={() => setMostrarModalAnadir(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary-hover)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Añadir usuario
          </button>
        )}
      </div>

      {/* Grid de tarjetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {usuarios.map((usuario) => {
          const colores = getColorRol(usuario.rol)
          const esYo = usuario.id === usuarioActualId
          const puedeActuar = esAdmin && !esYo

          return (
            <div
              key={usuario.id}
              className={`relative bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-3 ${!usuario.activo ? 'opacity-60' : ''}`}
            >
              {/* Badge "Tú" */}
              {esYo && (
                <span className="absolute top-4 right-4 text-xs font-semibold bg-[var(--primary)] text-white rounded-full px-2 py-0.5">
                  Tú
                </span>
              )}

              {/* Menú de acciones */}
              {puedeActuar && (
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => setMenuAbierto(menuAbierto === usuario.id ? null : usuario.id)}
                    className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                    </svg>
                  </button>
                  {menuAbierto === usuario.id && (
                    <div className="absolute right-0 top-8 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 w-48 z-10">
                      <button
                        onClick={() => { setUsuarioCambioRol(usuario); setMenuAbierto(null) }}
                        className="w-full text-left px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        Cambiar rol
                      </button>
                      <button
                        onClick={() => { setUsuarioCambioPassword(usuario); setMenuAbierto(null) }}
                        className="w-full text-left px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        Cambiar contraseña
                      </button>
                      {usuario.activo && (
                        <button
                          onClick={() => { handleDesactivar(usuario); setMenuAbierto(null) }}
                          disabled={cargando}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Avatar + Nombre */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${colores.avatar}`}>
                  {iniciales(usuario.nombre)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{usuario.nombre}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">@{usuario.email.replace('@rp-internal.com', '')}</p>
                </div>
              </div>

              {/* Badge de rol */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colores.badge}`}>
                  {getRolLabel(usuario.rol)}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${usuario.activo ? 'bg-green-400' : 'bg-[var(--text-secondary)]'}`} />
                  <span className={usuario.activo ? 'text-green-600' : 'text-[var(--text-secondary)]'}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </span>
              </div>

              {/* Descripción del rol */}
              <p className="text-xs text-[var(--text-secondary)]">{getRolDescripcion(usuario.rol)}</p>
            </div>
          )
        })}
      </div>
    </>
  )}

  {tabActiva === 'permisos' && puedeGestionar && rolUsuarioActual && (
    <ConfiguracionPermisos rolUsuarioActual={rolUsuarioActual} />
  )}

  {/* Toast */}
  {toast && (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
        toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {toast.mensaje}
    </div>
  )}

  {/* Modales */}
  {mostrarModalAnadir && <ModalAnadirUsuario />}
  {usuarioCambioRol && <ModalCambiarRol usuario={usuarioCambioRol} />}
  {usuarioCambioPassword && (
    <ModalCambiarPasswordAdmin
      usuario={usuarioCambioPassword}
      onClose={() => setUsuarioCambioPassword(null)}
      onExito={() => {
        setUsuarioCambioPassword(null)
        mostrarToast(`Contraseña de ${usuarioCambioPassword.nombre} actualizada`, 'exito')
      }}
    />
  )}

  {/* Overlay para cerrar menú */}
  {menuAbierto && (
    <div className="fixed inset-0 z-0" onClick={() => setMenuAbierto(null)} />
  )}
</div>
```

- [ ] **Step 6: Actualizar `app/dashboard/equipo/page.tsx` para pasar `rolUsuarioActual`**

Cambiar la llamada a `<EquipoClient`:
```tsx
<EquipoClient
  usuarios={usuarios}
  rolActual={isSuperadminMode ? 'admin' : rolActual ?? 'camarero'}
  usuarioActualId={userId}
  restaurantId={restaurantId}
  rolUsuarioActual={isSuperadminMode ? 'admin' : (rolActual === 'admin' || rolActual === 'gerente' ? rolActual : null)}
/>
```

- [ ] **Step 7: Verificar compilación**

```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add components/equipo/EquipoClient.tsx app/dashboard/equipo/page.tsx
git commit -m "feat(equipo): unificar equipo y permisos en tabs"
```

---

### Task 4: Redirigir `/dashboard/permisos` a `/dashboard/equipo`

**Files:**
- Modify: `app/dashboard/permisos/page.tsx`

- [ ] **Step 1: Reemplazar contenido de `app/dashboard/permisos/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default function PermisosPage() {
  redirect('/dashboard/equipo')
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/permisos/page.tsx
git commit -m "feat(permisos): redirigir /dashboard/permisos a /dashboard/equipo"
```
