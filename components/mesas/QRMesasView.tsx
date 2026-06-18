'use client'

import { useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface Mesa {
  id: string
  name: string
  capacity: number
  zone_id: string | null
}

interface Zona {
  id: string
  name: string
  color: string | null
}

interface Props {
  slug: string
  zonas: Zona[]
  mesas: Mesa[]
}

function urlMesa(slug: string, mesaId: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/cliente/${slug}/mesa/${mesaId}`
}

function descargarSVG(svgEl: SVGSVGElement, nombre: string) {
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgEl)
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `qr-${nombre}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

function QRCard({ mesa, slug }: { mesa: Mesa; slug: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const url = urlMesa(slug, mesa.id)

  const handleDescargar = useCallback(() => {
    if (svgRef.current) descargarSVG(svgRef.current, mesa.name)
  }, [mesa.name])

  return (
    <div className="flex flex-col items-center gap-3 p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:shadow-md transition-shadow">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{mesa.name}</div>
      {mesa.capacity > 0 && (
        <div className="text-xs text-[var(--text-secondary)]">{mesa.capacity} personas</div>
      )}
      <div className="p-2 bg-[var(--bg-surface)] rounded-lg border border-gray-100">
        <QRCodeSVG
          ref={svgRef}
          value={url}
          size={140}
          level="M"
          includeMargin={false}
        />
      </div>
      <p className="text-[10px] text-[var(--text-secondary)] text-center break-all max-w-[160px]">{url}</p>
      <button
        onClick={handleDescargar}
        className="w-full px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
      >
        Descargar SVG
      </button>
    </div>
  )
}

export default function QRMesasView({ slug, zonas, mesas }: Props) {
  const [zonaActiva, setZonaActiva] = useState<string | 'all'>('all')

  const mesasSinZona = mesas.filter(m => !m.zone_id)
  const zonasFiltradas = zonaActiva === 'all' ? zonas : zonas.filter(z => z.id === zonaActiva)
  const mostrarSinZona = zonaActiva === 'all' || zonaActiva === 'sin-zona'

  if (!slug) {
    return (
      <div className="text-sm text-[var(--text-secondary)] text-center py-16">
        El restaurante no tiene slug configurado. Contacta con soporte.
      </div>
    )
  }

  if (mesas.length === 0) {
    return (
      <div className="text-sm text-[var(--text-secondary)] text-center py-16">
        No hay mesas activas. Crea mesas desde el proceso de configuración.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro por zona */}
      {zonas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setZonaActiva('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              zonaActiva === 'all'
                ? 'bg-[var(--primary)] text-white'
                : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            Todas las zonas
          </button>
          {zonas.map(z => (
            <button
              key={z.id}
              onClick={() => setZonaActiva(z.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                zonaActiva === z.id
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              {z.name}
            </button>
          ))}
          {mesasSinZona.length > 0 && (
            <button
              onClick={() => setZonaActiva('sin-zona')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                zonaActiva === 'sin-zona'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              Sin zona
            </button>
          )}
        </div>
      )}

      {/* Mesas agrupadas por zona */}
      {zonasFiltradas.map(zona => {
        const mesasZona = mesas.filter(m => m.zone_id === zona.id)
        if (mesasZona.length === 0) return null
        return (
          <div key={zona.id}>
            <div className="flex items-center gap-2 mb-3">
              {zona.color && (
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zona.color }} />
              )}
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{zona.name}</h2>
              <span className="text-xs text-[var(--text-secondary)]">({mesasZona.length} mesas)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {mesasZona.map(mesa => (
                <QRCard key={mesa.id} mesa={mesa} slug={slug} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Mesas sin zona */}
      {mostrarSinZona && mesasSinZona.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Sin zona asignada</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {mesasSinZona.map(mesa => (
              <QRCard key={mesa.id} mesa={mesa} slug={slug} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
