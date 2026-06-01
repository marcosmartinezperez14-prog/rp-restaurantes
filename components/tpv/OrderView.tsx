'use client'

import { useState, useTransition } from 'react'
import type { OrderWithItems, OrderItem, Category, ProductWithModifiers, SelectedModifier } from '@/app/actions/tpv'
import { addOrderItem } from '@/app/actions/tpv'
import ProductsPanel from './ProductsPanel'
import OrderPanel from './OrderPanel'

interface Props {
  order: OrderWithItems
  categories: Category[]
  products: ProductWithModifiers[]
}

export default function OrderView({ order, categories, products }: Props) {
  const [items, setItems] = useState<OrderItem[]>(order.items)
  const [isPending, startTransition] = useTransition()

  function handleAddProduct(productId: string, modifiers: SelectedModifier[], quantity: number) {
    startTransition(async () => {
      const result = await addOrderItem(order.id, productId, quantity, modifiers)
      if ('error' in result) return
      const product = products.find(p => p.id === productId)
      if (!product) return
      const unitPrice = product.price + modifiers.reduce((s, m) => s + m.price_adjustment, 0)
      const newItem: OrderItem = {
        id: result.itemId,
        product_name: product.name,
        product_price: product.price,
        tax_rate: product.tax_rate,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        modifiers,
        notes: null,
        status: 'pending',
      }
      setItems(prev => [...prev, newItem])
    })
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-[3] overflow-hidden">
        <ProductsPanel
          categories={categories}
          products={products}
          onAddProduct={handleAddProduct}
          disabled={isPending}
        />
      </div>
      <div className="flex-[2] overflow-hidden">
        <OrderPanel
          order={order}
          items={items}
          onItemsChange={setItems}
        />
      </div>
    </div>
  )
}
