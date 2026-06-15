# Auditoría de seguridad y eficiencia — RP (multi-tenant SaaS)

**Fecha:** 2026-06-15
**Alcance:** Next.js 14 App Router + TypeScript + Supabase (PostgreSQL/Auth/Storage/RLS) + Vercel.
**Naturaleza:** Solo auditoría. No se implementó ningún arreglo.

---

## 1. Resumen ejecutivo

| Severidad | Nº |
|---|---|
| 🔴 CRÍTICA | 2 |
| 🟠 ALTA | 5 |
| 🟡 MEDIA | 9 |
| ⚪ BAJA | 3 |

**Veredicto:** la capa **RLS está bien implementada** (todas las tablas con RLS activo y políticas filtradas por `restaurant_id`). El riesgo multi-tenant se concentra **exclusivamente en las rutas que usan `service_role`**, que saltan RLS y no validan ownership a mano. Hay IDOR cross-tenant explotables hoy por cualquier usuario autenticado. **No salir a producción sin arreglar el Top 5.**

> Nota de honestidad: el hallazgo #1 (IDOR en `verifactu/enviar`) se introdujo en el refactor de la sesión que cableó las RPCs fiscales. Queda documentado sin excusa.

### Verificaciones positivas (confirmadas)
- ✅ **RLS**: ninguna tabla con `relrowsecurity=false`; políticas filtran por `restaurant_id` (salvo `roles` SELECT `true`, catálogo, aceptable).
- ✅ **`search_path`** fijado en las 4 RPCs `fiscal_*` (`SET search_path = public, pg_temp`) → sin hijacking.
- ✅ **Secretos**: sin claves hardcodeadas; `NEXT_PUBLIC_*` solo contiene URL + publishable key; `SUPABASE_SERVICE_ROLE_KEY` sin prefijo público y nunca importada en Client Components.
- ✅ **Pedido público por QR**: re-calcula precios en servidor y valida items por restaurante (no confía en el cliente).
- ✅ **Inmutabilidad fiscal** (triggers 007 + RPCs 008) verificada end-to-end.
- ✅ **`tickets/print`** y **`equipo/cambiar-password`**: validan ownership de tenant correctamente (patrón de referencia).
- ✅ **Índices**: FKs (`restaurant_id`, `order_id`) y numeración correlativa indexadas.

### No aplica / inexistente
- **Item 15 (análisis de facturas con Anthropic):** no existe integración Anthropic en el repo.
- **Item 14 (subida de facturas a Storage):** no hay subida de facturas; solo imagen de producto en `components/carta/MenuItemFormPanel.tsx`. Políticas de Storage no versionadas (verificar en Supabase).

---

## 2. Hallazgos detallados

| # | Sev | Área | Archivo:línea | Riesgo | Arreglo propuesto |
|---|---|---|---|---|---|
| 1 | 🔴 | IDOR fiscal | `app/api/verifactu/enviar/route.ts:21-40` | Llama RPCs `SECURITY DEFINER` con `ticketId` del body sin validar tenant → cualquier usuario emite tickets ajenos y usa la `verifacti_api_key` de otro restaurante. | Validar `ticket.restaurant_id === restauranteDelUsuario` antes de operar; combinar con #2. |
| 2 | 🟠 | Defensa en profundidad | `008_*.sql` (4 RPCs) | Las RPCs operan solo por `p_ticket_id`, sin validar pertenencia. Causa raíz de #1. | Añadir `p_restaurant_id` y `WHERE ... AND restaurant_id = p_restaurant_id`. |
| 3 | 🔴 | IDOR + escalada | `app/api/equipo/cambiar-rol/route.ts:47-50` | `update user_roles` por `id` con `service_role` sin scoping de tenant; `nuevo_rol` arbitrario. Admin de A cambia roles en B / escala a superadmin. | Validar tenant destino (como `cambiar-password`) + lista blanca de roles. |
| 4 | 🟠 | IDOR | `app/api/equipo/desactivar-usuario/route.ts:45-48` | Desactiva usuarios de cualquier tenant (DoS/lockout). | Validar `restaurant_id` del usuario destino. |
| 5 | 🟠 | Authz | `app/actions/admin.ts:6-18,41-49` | `clearAllData` sin check de rol → cualquier empleado vacía datos del restaurante. | Exigir rol admin/módulo administración en servidor. |
| 6 | 🟠 | Escalada | `app/api/equipo/crear-usuario/route.ts:73-77` | `role_name` arbitrario → un gerente crea un admin. | Lista blanca de roles asignables por rol del caller. |
| 7 | 🟠 | Integridad cadena fiscal | `008_*.sql fiscal_persistir_emision` | `prev_hash` no serializado por restaurante (solo `FOR UPDATE` de la fila objetivo) → emisiones concurrentes ⇒ cadena ramificada/duplicada. | `pg_advisory_xact_lock(hashtext('fiscal:'||restaurant_id))` en claim/persistir. |
| 8 | 🟡 | Abuso público | `app/api/cliente/[slug]/reservas/route.ts` | Sin rate-limit/dedup; `num_personas` sin tope; campos sin límite. Spam de reservas. | Rate-limit + topes + validación. |
| 9 | 🟡 | Abuso público | `app/api/cliente/[slug]/mesa/[mesa_id]/route.ts:80` | POST de pedido sin rate-limit. | Rate-limit por IP+mesa. |
| 10 | 🟡 | Enum/colisión | `app/api/equipo/crear-usuario/route.ts:26` | `username@rp-internal.com` global → colisión entre tenants + enumeración por error de `createUser`. | Namespacing por tenant + error genérico. |
| 11 | 🟡 | Fuga de info | múltiple (`cambiar-rol:53`, `reservas:48,89`, `caja/cerrar`, `anular`…) | Devuelven `error.message` de Postgres → filtran esquema. | Helper `jsonError()` con mensajes genéricos; log en servidor. |
| 12 | 🟡 | Índice faltante | `tickets` (BD) | Falta índice para la consulta de `prev_hash` (`restaurant_id, verifactu_sent_at DESC WHERE verifactu_hash IS NOT NULL`); hoy hace sort en memoria. | Crear índice parcial; agrava #7. |
| 13 | 🟡 | Inconsistencia estado | `tickets.verifactu_status` (BD vs código) | Índice parcial cubre `('pending','queued','rejected')` pero el código escribe `'enviando','Correcto','error'` → consultas de "pendientes/fallidos" no los encuentran. | Unificar enum de estado y rehacer índice parcial sobre estados reales. |
| 14 | 🟡 | Validación entrada | rutas/acciones | Sin zod; se confía en la forma del body. | Validar input con zod. |
| 15 | 🟡 | IDOR (baja sens.) | `app/api/modificadores/[menu_item_id]/route.ts:11-16` | GET sin auth con `service_role` por UUID sin scoping (datos de menú). | Scopear por restaurante o exigir auth. |
| 16 | 🟡 | Realtime | `components/cocina/CocinaClient.tsx:64-66` | Suscripción a `order_items` sin `filter` por tenant → coste global + payloads ajenos por la red. (`TableMap.tsx` sí filtra ✅). | Añadir `filter: restaurant_id=eq.${restaurantId}` + confirmar RLS en Realtime. |
| 17 | ⚪ | Higiene | `equipo/*` | `supabaseAdmin` redefinido en cada ruta en vez de `@/lib/supabase/admin`. | Centralizar; lint anti `SERVICE_ROLE` fuera de server. |
| 18 | ⚪ | Over-fetch | ~12 `select('*')` | Columnas de más; faltan paginaciones en listados que crecen. | Columnas explícitas + paginación. |
| 19 | ⚪ | Funcional | `app/actions/admin.ts:41` + `004_clear_all_data.sql` | `DELETE` de tickets/payments rotos por 007. | Excluir tablas fiscales / restaurante desechable. |

---

## 3. Top 5 antes de producción

1. **#1** IDOR fiscal en `verifactu/enviar` — validar ownership.
2. **#3** Cross-tenant IDOR + escalada en `cambiar-rol`.
3. **#2** RPCs `fiscal_*` con validación de pertenencia (defensa en profundidad).
4. **#4 + #5 + #6** Authz de gestión de usuarios/datos.
5. **#7** Serializar `prev_hash` por restaurante (integridad de la cadena fiscal).

---

## 4. Quick wins

- Copiar el bloque de validación de tenant de `cambiar-password` a `cambiar-rol` y `desactivar-usuario`.
- Check de rol admin en `clearAllData`.
- Lista blanca de roles en `crear-usuario`.
- Mensaje de error genérico en alta de usuario (mitiga enumeración).
- `filter: restaurant_id=eq.${restaurantId}` en `CocinaClient`.
- Helper `jsonError()` para no propagar `error.message` de Postgres.

---

## 5. Plan de remediación (orden de ejecución)

- **Fase 0 (contención, solo código):** R1 (#1), R2 (#3,#4,#5,#6). ✅ HECHA
- **Fase 1 (migración 009 + callers):** R3 (#2), R4 (#7), índice #12, enum #13. ✅ HECHA
- **Fase 2 (endurecimiento público):** R5 (#8,#9,#11,#15,#16,#14). ✅ HECHA

### Detalle de Fase 2 (implementada)
- **#16** Filtro `restaurant_id` en la suscripción Realtime de `CocinaClient` (verificado que `order_items.restaurant_id` existe).
- **#11** Helper `lib/api/errors.ts` (`jsonError`) + mensajes genéricos en todas las rutas API y server actions; el detalle real se loguea en servidor. Únicas excepciones conscientes: mensajes `RAISE EXCEPTION` controlados de las RPCs fiscales y la herramienta de debug `getDiagnostics` (auth-gated).
- **#10** Mensaje genérico en alta de usuario (mitiga enumeración).
- **#8 / #9** Rate-limit de ventana deslizante en Postgres (`migración 010_rate_limit.sql` + `lib/api/rate-limit.ts`), aplicado a reservas (5/10 min) y pedido por QR (20/5 min); fail-open ante fallo de infra. Topes de longitud/cantidad en endpoints públicos.
- **#14** Validación con **zod** en **todas** las rutas API (40) que reciben body y en **todas** las server actions de mutación (reservas, cocina, tema, admin, auth, administracion, superadmin, onboarding, productos, tpv).
- **#15** Fuga de `error.message` cerrada en `modificadores/[menu_item_id]`.

**Pendiente operativo:** aplicar la migración `010_rate_limit.sql` en Supabase antes de desplegar (la tabla/RPC `check_rate_limit` deben existir; si no, el rate-limit es fail-open y no bloquea).

### DDL propuesto (migración 009, NO aplicado)
```sql
-- índice de soporte para prev_hash (#12)
CREATE INDEX IF NOT EXISTS idx_tickets_prev_hash
  ON public.tickets (restaurant_id, verifactu_sent_at DESC)
  WHERE verifactu_hash IS NOT NULL;
```

---

## 6. Pendiente de decisión del equipo
- Tablas legacy/duplicadas (`movimientos` vs `stock_movements`, `turnos` vs `turnos_caja`, `facturas`, `verifactu_queue`): confirmar si están en uso o eliminarlas para reducir superficie.
- Unificar vocabulario de `verifactu_status` (#13).
