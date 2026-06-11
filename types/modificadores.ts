export type ModifierGroupType = 'variante' | 'modificador'

export interface ModifierOption {
  id: string
  group_id: string
  name: string
  price_delta: number
  is_default: boolean
  is_active: boolean
  sort_order: number
}

export interface ModifierGroup {
  id: string
  restaurant_id: string
  menu_item_id: string
  name: string
  type: ModifierGroupType
  required: boolean
  allows_multiple: boolean
  sort_order: number
  is_active: boolean
  options: ModifierOption[]
}

export interface ModifierSnapshot {
  group_id: string
  group_name: string
  group_type: ModifierGroupType
  option_id: string
  option_name: string
  price_delta: number
}

export interface ModifierSelection {
  group_id: string
  option_ids: string[]
}

export interface ItemConModificadores {
  menu_item_id: string
  cantidad: number
  precio_final: number
  modifiers_snapshot: ModifierSnapshot[]
  nota?: string
}
