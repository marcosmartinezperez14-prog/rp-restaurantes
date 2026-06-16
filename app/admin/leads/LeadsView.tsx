'use client'

import { useState } from 'react'

interface LeadPago {
  id: string; nombre: string; nombre_restaurante: string; email: string
  telefono: string; estado: string; created_at: string; stripe_session_id: string | null
}
interface LeadContacto {
  id: string; nombre: string; nombre_restaurante: string; email: string
  telefono: string; mensaje: string | null; atendido: boolean; created_at: string
}

const ESTADO_COLOR: Record<string, string> = {
  iniciado: 'bg-yellow-100 text-yellow-700',
  pagado: 'bg-green-100 text-green-700',
  fallido: 'bg-red-100 text-red-700',
}

export default function LeadsView({ leadsPago, leadsContacto }: { leadsPago: LeadPago[], leadsContacto: LeadContacto[] }) {
  const [tab, setTab] = useState<'pago' | 'contacto'>('pago')

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Panel de leads</h1>
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('pago')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'pago' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            Leads de pago ({leadsPago.length})
          </button>
          <button onClick={() => setTab('contacto')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'contacto' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            Solicitudes de demo ({leadsContacto.length})
          </button>
        </div>

        {tab === 'pago' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  {['Nombre', 'Restaurante', 'Email', 'Teléfono', 'Estado', 'Fecha'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadsPago.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{l.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{l.nombre_restaurante}</td>
                    <td className="px-4 py-3 text-slate-600">{l.email}</td>
                    <td className="px-4 py-3 text-slate-600">{l.telefono}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${ESTADO_COLOR[l.estado] ?? ''}`}>{l.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(l.created_at).toLocaleDateString('es-ES')}</td>
                  </tr>
                ))}
                {leadsPago.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin leads todavía</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'contacto' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  {['Nombre', 'Restaurante', 'Email', 'Teléfono', 'Mensaje', 'Atendido', 'Fecha'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadsContacto.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{l.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{l.nombre_restaurante}</td>
                    <td className="px-4 py-3 text-slate-600">{l.email}</td>
                    <td className="px-4 py-3 text-slate-600">{l.telefono}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{l.mensaje ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${l.atendido ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {l.atendido ? 'Sí' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(l.created_at).toLocaleDateString('es-ES')}</td>
                  </tr>
                ))}
                {leadsContacto.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin solicitudes todavía</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
