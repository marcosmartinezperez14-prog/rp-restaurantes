'use client'

import type { MenuItem, Categoria, ProductoConCategoria } from '@/app/actions/productos'

interface Props {
  initialMenuItems: MenuItem[]
  categories: Categoria[]
  allProducts: ProductoConCategoria[]
  onProductsRefresh: () => void
}

export default function CartaClient(_props: Props) {
  return (
    <div className="flex items-center justify-center py-20 text-[#94a3b8]">
      <p className="text-sm">Cargando módulo de carta...</p>
    </div>
  )
}
