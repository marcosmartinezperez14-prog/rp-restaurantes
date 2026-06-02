# TPV Edit Mode — Spec

**Date:** 2026-06-02  
**Goal:** Allow adding and removing tables and zones directly from the TPV map via a toggleable edit mode.

---

## Behaviour

### Edit mode toggle
- Button "Editar mapa" in `TableMap` nav bar (right side, next to "Actualizar").
- When active: nav bar turns amber, button changes to "✓ Salir de edición", normal table-click actions are disabled.
- State is local (`isEditing: boolean`) — reset to false on page navigation.

### Tables in edit mode
- Each `TableCard` shows a red ✕ button (top-right overlay).
- ✕ is only enabled when `table.status === 'free'`. Occupied/billing/reserved tables show ✕ disabled with a tooltip "Cierra la comanda primero".
- Clicking ✕ calls `deleteTable(tableId)` (soft-delete) and removes the card from local state optimistically.
- At the end of each zone's card row: a "+ Mesa" button that opens `AddTableModal`.

### Zones in edit mode
- Each zone header shows a 🗑 icon button.
- 🗑 is only enabled when the zone has no active tables. Otherwise disabled with tooltip "Elimina las mesas primero".
- Clicking 🗑 calls `deleteZone(zoneId)` and removes the zone from local state.
- Below all zones: a "+ Nueva zona" button that opens `AddZoneModal`.

---

## Server Actions (additions to `app/actions/tpv.ts`)

| Action | Params | Logic |
|--------|--------|-------|
| `addTable` | `{ name, capacity, zoneId }` | Insert table: `status='free'`, `is_active=true`, ownership check |
| `deleteTable` | `tableId` | Soft-delete (`deleted_at = now()`) only if `status === 'free'` |
| `addZone` | `{ name, color }` | Insert zone, `position` = max existing + 1 |
| `deleteZone` | `zoneId` | Soft-delete only if no active tables in zone |

All actions verify `restaurant_id` ownership before mutation.

---

## New Components

### `components/tpv/AddTableModal.tsx`
Fields: Nombre (text, required), Capacidad (number ≥ 1, required), Zona (select from existing zones, required).  
On save: calls `addTable`, closes modal, appends new table to local zone state.

### `components/tpv/AddZoneModal.tsx`
Fields: Nombre (text, required), Color (6 preset swatches: slate, blue, green, amber, red, purple).  
On save: calls `addZone`, closes modal, appends new zone to local state.

---

## Changes to Existing Files

- `components/tpv/TableCard.tsx` — add `isEditing?: boolean` prop; render ✕ overlay when true.
- `components/tpv/TableMap.tsx` — add `isEditing` state, edit-mode nav, pass `isEditing` to `TableCard`, render "+ Mesa" / 🗑 / "+ Nueva zona" controls.
- `app/actions/tpv.ts` — add 4 new server actions.

---

## Error handling
- Mutations show errors in the existing red banner in `TableMap`.
- If `deleteTable` fails because table is not free, show specific message.
- If `deleteZone` fails because zone has tables, show specific message.

---

## Out of scope
- Editing table name/capacity after creation (can be done from onboarding for now).
- Drag-and-drop reordering.
- Moving a table between zones.
