/**
 * lib/offline/db.ts
 * IndexedDB wrapper para la cola de operaciones offline del TPV.
 * Usa la API nativa de IndexedDB con Promises — sin librerías externas.
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type OperationType =
  | 'create_order'
  | 'add_item'
  | 'pay_order'
  | 'change_table_status'
  | 'close_shift'

export type OperationStatus = 'pending' | 'processing' | 'failed' | 'done'

export interface PendingOperation {
  id: string // UUID v4 generado en cliente con crypto.randomUUID()
  type: OperationType
  endpoint: string // ruta exacta, p.ej. '/api/orders'
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  payload: Record<string, unknown>
  timestamp: number // Date.now()
  attempts: number // empieza en 0
  maxAttempts: number // siempre 5
  status: OperationStatus
  errorMessage?: string
  localId?: string // ID temporal asignado en cliente para operaciones create
}

// ---------------------------------------------------------------------------
// Constantes internas
// ---------------------------------------------------------------------------

const DB_NAME = 'rp-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending_operations'

// ---------------------------------------------------------------------------
// Caché de instancia (evita re-abrir la DB en cada llamada)
// ---------------------------------------------------------------------------

let _db: IDBDatabase | null = null
let _opening: Promise<IDBDatabase> | null = null

// ---------------------------------------------------------------------------
// Helper: envuelve un IDBRequest en una Promise tipada
// ---------------------------------------------------------------------------

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ---------------------------------------------------------------------------
// Helper: espera a que una transacción complete (oncomplete) antes de
// considerar la escritura durable en disco.
// ---------------------------------------------------------------------------

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// ---------------------------------------------------------------------------
// openDB
// ---------------------------------------------------------------------------

/**
 * Inicializa (o abre) la base de datos IndexedDB.
 * Cachea la instancia en una variable de módulo.
 * Protegida contra entornos SSR (window/indexedDB no disponibles).
 *
 * Fix C1: cachea también la promesa en curso para evitar que llamadas
 * concurrentes abran múltiples instancias antes de que la primera resuelva.
 * Fix m4: registra onversionchange para cerrar la conexión si otra pestaña
 * intenta actualizar la DB.
 */
export async function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB no está disponible en entornos SSR.')
  }

  if (_db !== null) return _db
  if (_opening !== null) return _opening

  _opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
    }

    request.onsuccess = () => {
      _db = request.result
      // m4: si otra pestaña sube la versión, cerramos limpiamente
      _db.onversionchange = () => {
        _db?.close()
        _db = null
      }
      _opening = null
      resolve(_db)
    }

    request.onerror = () => {
      _opening = null
      reject(request.error)
    }

    request.onblocked = () => {
      _opening = null
      reject(new Error('IndexedDB bloqueada por otra pestaña.'))
    }
  })

  return _opening
}

// ---------------------------------------------------------------------------
// enqueue
// ---------------------------------------------------------------------------

/**
 * Añade una operación a la cola.
 * Genera id, timestamp, attempts y status automáticamente.
 */
export async function enqueue(
  op: Omit<PendingOperation, 'id' | 'timestamp' | 'attempts' | 'status'>
): Promise<PendingOperation> {
  const db = await openDB()

  // m1: fallback para entornos que no implementan crypto.randomUUID
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const operation: PendingOperation = {
    ...op,
    id,
    timestamp: Date.now(),
    attempts: 0,
    status: 'pending',
  }

  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  // I3: esperamos tanto el add como el oncomplete de la transacción
  await promisifyRequest(store.add(operation))
  await waitTx(tx)

  return operation
}

// ---------------------------------------------------------------------------
// getPending
// ---------------------------------------------------------------------------

/**
 * Devuelve todas las operaciones con status 'pending', ordenadas por
 * timestamp ASC (orden cronológico de inserción).
 *
 * I1+I2: usa el índice 'status' para filtrar en IDB en vez de traer todo
 * y filtrar en JS; ordena en memoria por timestamp.
 */
export async function getPending(): Promise<PendingOperation[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('status')

    // IDBIndex.getAll() está tipado como IDBRequest<any[]> en el DOM lib
    const req = index.getAll(IDBKeyRange.only('pending')) as IDBRequest<PendingOperation[]>

    req.onsuccess = () =>
      resolve((req.result ?? []).sort((a, b) => a.timestamp - b.timestamp))
    req.onerror = () => reject(req.error)
  })
}

// ---------------------------------------------------------------------------
// updateOperation
// ---------------------------------------------------------------------------

/**
 * Actualiza campos parciales de una operación existente (status, attempts,
 * errorMessage).
 */
export async function updateOperation(
  id: string,
  changes: Partial<Pick<PendingOperation, 'status' | 'attempts' | 'errorMessage'>>
): Promise<void> {
  const db = await openDB()

  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  const existing = await promisifyRequest<PendingOperation | undefined>(
    store.get(id) as IDBRequest<PendingOperation | undefined>
  )

  if (existing === undefined) {
    throw new Error(`Operación no encontrada: ${id}`)
  }

  const updated: PendingOperation = { ...existing, ...changes }

  // I3: esperamos tanto el put como el oncomplete de la transacción
  await promisifyRequest(store.put(updated))
  await waitTx(tx)
}

// ---------------------------------------------------------------------------
// dequeue
// ---------------------------------------------------------------------------

/**
 * Elimina una operación de la cola (llamar cuando se completa con éxito).
 */
export async function dequeue(id: string): Promise<void> {
  const db = await openDB()

  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  // I3: esperamos tanto el delete como el oncomplete de la transacción
  await promisifyRequest(store.delete(id))
  await waitTx(tx)
}

// ---------------------------------------------------------------------------
// getFailed
// ---------------------------------------------------------------------------

/**
 * Devuelve todas las operaciones con status 'failed', ordenadas por
 * timestamp ASC (orden cronológico de inserción).
 */
export async function getFailed(): Promise<PendingOperation[]> {
  if (typeof window === 'undefined') return []
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('status')

    // IDBIndex.getAll() está tipado como IDBRequest<any[]> en el DOM lib
    const req = index.getAll(IDBKeyRange.only('failed')) as IDBRequest<PendingOperation[]>

    req.onsuccess = () =>
      resolve((req.result ?? []).sort((a, b) => a.timestamp - b.timestamp))
    req.onerror = () => reject(req.error)
  })
}

// ---------------------------------------------------------------------------
// countPending
// ---------------------------------------------------------------------------

/**
 * Devuelve el número total de operaciones con status 'pending'.
 * Útil para el indicador visual de sincronización pendiente.
 */
export async function countPending(): Promise<number> {
  if (typeof window === 'undefined') return 0

  const db = await openDB()

  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index('status')

  return promisifyRequest<number>(
    index.count(IDBKeyRange.only('pending')) as IDBRequest<number>
  )
}
