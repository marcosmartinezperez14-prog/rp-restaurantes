'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { CategoriaCarta, ItemCarta } from '@/app/api/cliente/[slug]/carta/route'

type ItemCarrito = ItemCarta & { cantidad: number }

export default function MesaPage() {
  const params = useParams()
  const slug = params.slug as string
  const mesaId = params.mesa_id as string

  const [mesa, setMesa] = useState<{ id: string; nombre: string } | null>(null)
  const [carta, setCarta] = useState<CategoriaCarta[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/cliente/${slug}/mesa/${mesaId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setMesa(data.mesa)
        setCarta(data.carta)
      })
      .catch(() => setError('No se pudo cargar la carta'))
      .finally(() => setCargando(false))
  }, [slug, mesaId])

  function añadir(item: ItemCarta) {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === item.id)
      if (existe) return prev.map(i => i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { ...item, cantidad: 1 }]
    })
  }

  function quitar(itemId: string) {
    setCarrito(prev => {
      const item = prev.find(i => i.id === itemId)
      if (!item) return prev
      if (item.cantidad === 1) return prev.filter(i => i.id !== itemId)
      return prev.map(i => i.id === itemId ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
  }

  function cantidadEnCarrito(itemId: string): number {
    return carrito.find(i => i.id === itemId)?.cantidad ?? 0
  }

  const totalCarrito = carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0)
  const totalItems = carrito.reduce((sum, i) => sum + i.cantidad, 0)

  async function handleEnviarPedido() {
    setErrorEnvio(null)
    setEnviando(true)
    try {
      const res = await fetch(`/api/cliente/${slug}/mesa/${mesaId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: carrito.map(i => ({
            menu_item_id: i.id,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorEnvio(data.error ?? 'No se pudo enviar el pedido'); return }
      setPedidoEnviado(true)
      setCarrito([])
    } catch {
      setErrorEnvio('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm">Cargando carta...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <p className="text-red-500 text-sm text-center">{error}</p>
      </div>
    )
  }

  if (pedidoEnviado) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">🍽️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Pedido enviado!</h2>
        <p className="text-gray-500 text-sm">El equipo ya está preparando tu pedido.</p>
        <button
          onClick={() => setPedidoEnviado(false)}
          className="inline-block mt-6 px-4 py-2 text-sm text-blue-600 underline"
        >
          Pedir más
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-36">
      {/* Cabecera */}
      <div className="text-center mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Mesa</p>
        <h1 className="text-2xl font-bold text-gray-900">{mesa?.nombre}</h1>
      </div>

      {/* Carta */}
      {carta.length === 0 ? (
        <p className="text-center text-gray-500 py-12">La carta no está disponible.</p>
      ) : (
        <div className="space-y-8">
          {carta.map(categoria => (
            <section key={categoria.id}>
              <h2 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b border-gray-200">
                {categoria.nombre}
              </h2>
              <div className="space-y-2">
                {categoria.items.map(item => {
                  const cantidad = cantidadEnCarrito(item.id)
                  return (
                    <div key={item.id} className="flex gap-3 py-3">
                      {item.imagen_url && (
                        <img
                          src={item.imagen_url}
                          alt={item.nombre}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900 text-sm">{item.nombre}</p>
                          <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                            {item.precio.toFixed(2)} €
                          </p>
                        </div>
                        {item.descripcion && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.descripcion}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {cantidad > 0 ? (
                            <>
                              <button
                                onClick={() => quitar(item.id)}
                                className="w-7 h-7 rounded-full border border-gray-300 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-50 text-sm"
                              >
                                −
                              </button>
                              <span className="text-sm font-semibold text-gray-900 min-w-[1rem] text-center">
                                {cantidad}
                              </span>
                            </>
                          ) : null}
                          <button
                            onClick={() => añadir(item)}
                            className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center hover:bg-blue-700 text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Carrito flotante */}
      {carrito.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
          {errorEnvio && (
            <p className="text-xs text-red-600 mb-2 text-center">{errorEnvio}</p>
          )}
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">{totalItems} {totalItems === 1 ? 'plato' : 'platos'}</p>
              <p className="text-lg font-bold text-gray-900">{totalCarrito.toFixed(2)} €</p>
            </div>
            <button
              onClick={handleEnviarPedido}
              disabled={enviando}
              className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {enviando ? 'Enviando...' : 'Enviar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
