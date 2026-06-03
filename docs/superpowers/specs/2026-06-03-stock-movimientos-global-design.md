# Página de Movimientos de Stock Global — Design Spec

**Fecha:** 2026-06-03
**Scope:** Nueva sub-página `/productos/movimientos` que muestra todos los movimientos de stock del restaurante, con filtros por tipo, producto y rango de fechas, estadísticas de resumen y paginación.

---

## Objetivo

Proporcionar una vista global de todos los movimientos de stock (compras, ventas, ajustes, mermas) del restaurante en una sola página, accesible desde la página de Productos.

---

## Navegación y acceso

- La página vive en `/productos/movimientos`.
- Se accede desde `/productos` mediante un botón **"Ver movimientos"** añadido a la barra de filtros existente, junto al botón "Categorías".
- La página muestra un breadcrumb `← Productos / Movimientos de stock`.

---

## Layout de la página

### 1. Tarjetas de resumen (parte superior)

Cuatro tarjetas horizontales que muestran los totales del período filtrado actualmente:

| Tarjeta | Valor | Color |
|---------|-------|-------|
| Compras | Total unidades entrada (`+`) | Verde (`text-green-700`) |
| Ventas  | Total unidades salida (`-`) | Azul (`text-blue-700`) |
| Ajustes | Total unidades ajustadas | Ámbar (`text-amber-700`) |
| Mermas  | Total unidades perdidas (`-`) | Rojo (`text-red-600`) |

Cada tarjeta muestra también el número de movimientos de ese tipo.

Las tarjetas reflejan los filtros activos: si el usuario filtra por producto o fecha, los totales se actualizan para mostrar solo ese subset.

### 2. Barra de filtros

Controles en una sola fila (con wrap en móvil):

- **Tipo** — `<select>`: Todos los tipos / Compra / Venta / Ajuste / Merma
- **Producto** — `<select>`: Todos los productos + lista de productos del restaurante ordenada por nombre
- **Fecha desde** — `<input type="date">`
- **Fecha hasta** — `<input type="date">`
- **Botón "Limpiar"** — resetea todos los filtros a sus valores por defecto

### 3. Tabla de movimientos

Columnas:

| Columna | Detalle |
|---------|---------|
| Fecha | `DD/MM/YYYY HH:mm` basado en `created_at` |
| Producto | `products.name` |
| Tipo | Badge de color (mismo esquema que `StockHistory`) |
| Cantidad | Con signo y color: `+N` verde para compra/ajuste positivo, `-N` rojo para merma/venta |
| P. Coste | `cost_price` en `€/u`, `—` si null |
| Notas | `notes`, `—` si null |

Ordenación: `created_at DESC` (más reciente primero).

### 4. Paginación

- 50 movimientos por página.
- Pie de tabla: `«N movimientos · página X de Y»` + botones `← Anterior` / `Siguiente →`.
- Los botones se deshabilitan en primera/última página.
- Al cambiar filtros, la paginación vuelve a página 1.

---

## Arquitectura (Opción A)

Patrón idéntico al de `ProductsClient.tsx`:

### Server Component (`app/productos/movimientos/page.tsx`)
- Obtiene los datos iniciales (página 1, sin filtros) mediante un nuevo server action.
- Pasa `initialData` y lista de productos al componente cliente.
- Usa el mismo `AppShell` y layout que el resto de la app.

### Client Component (`app/productos/movimientos/MovimientosClient.tsx`)
- Gestiona el estado de filtros (`tipo`, `productoId`, `fechaDesde`, `fechaHasta`) y paginación (`page`).
- Llama al server action `getMovimientosGlobal` en `useTransition` cuando cambia cualquier filtro o página.
- Renderiza tarjetas, barra de filtros, tabla y paginación.

### Nuevo server action `getMovimientosGlobal`

```typescript
export async function getMovimientosGlobal(params: {
  tipo?: 'compra' | 'venta' | 'ajuste' | 'merma'
  productoId?: string
  fechaDesde?: string   // ISO date string 'YYYY-MM-DD'
  fechaHasta?: string   // ISO date string 'YYYY-MM-DD'
  page: number          // 1-indexed
  pageSize?: number     // default 50
}): Promise<{
  movements: MovimientoGlobal[]
  total: number
  stats: StockStats
}>
```

Tipo `MovimientoGlobal` (extensión de `StockMovement`):
```typescript
export type MovimientoGlobal = StockMovement & {
  product_name: string
}
```

Tipo `StockStats`:
```typescript
export type StockStats = {
  compras: { total: number; count: number }
  ventas:  { total: number; count: number }
  ajustes: { total: number; count: number }
  mermas:  { total: number; count: number }
}
```

La query une `stock_movements` con `products` para traer `products.name`. Filtra por `restaurant_id`, aplica filtros opcionales y usa `.range()` para paginación. Las stats se calculan con una segunda query Supabase separada: mismos filtros pero sin `.range()`, agrupando por `type` con `count` y `sum(quantity)` — o iterando los resultados completos si Supabase no soporta group-by en el client. En cualquier caso, las stats reflejan el subset filtrado completo, no solo la página actual.

---

## Ficheros afectados

| Fichero | Cambio |
|---------|--------|
| `app/actions/productos.ts` | Añadir `getMovimientosGlobal`, tipos `MovimientoGlobal` y `StockStats` |
| `app/productos/movimientos/page.tsx` | Nuevo — Server Component de la sub-página |
| `app/productos/movimientos/MovimientosClient.tsx` | Nuevo — Client Component con filtros, tabla y paginación |
| `app/productos/ProductsClient.tsx` | Añadir botón "Ver movimientos" en la barra de filtros |

---

## Lo que NO cambia

- `StockHistory.tsx` — historial por producto sigue igual.
- No se añade nueva entrada en el `NavDrawer`.
- El esquema de la base de datos no cambia.
- No se implementa exportación a CSV ni ordenación de columnas (fuera de scope).
