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
// openDB
// ---------------------------------------------------------------------------

/**
 * Inicializa (o abre) la base de datos IndexedDB.
 * Cachea la instancia en una variable de módulo.
 * Protegida contra entornos SSR (window/indexedDB no disponibles).
 */
export async function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB no está disponible en entornos SSR.')
  }

  if (_db !== null) {
    return _db
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
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
      resolve(_db)
    }

    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error('IndexedDB bloqueada por otra pestaña.'))
  })
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

  const operation: PendingOperation = {
    ...op,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    attempts: 0,
    status: 'pending',
  }

  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  await promisifyRequest(store.add(operation))

  return operation
}

// ---------------------------------------------------------------------------
// getPending
// ---------------------------------------------------------------------------

/**
 * Devuelve todas las operaciones con status 'pending', ordenadas por
 * timestamp ASC (orden cronológico de inserción).
 */
export async function getPending(): Promise<PendingOperation[]> {
  const db = await openDB()

  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index('timestamp')

  // getAll sobre el índice timestamp devuelve los registros ordenados ASC
  const all = await promisifyRequest<PendingOperation[]>(
    index.getAll() as IDBRequest<PendingOperation[]>
  )

  return all.filter((op) => op.status === 'pending')
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
  await promisifyRequest(store.put(updated))
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

  await promisifyRequest(store.delete(id))
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
