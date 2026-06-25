-- Añadir estación de despacho a categorías de carta y a líneas de comanda

alter table menu_categories
  add column if not exists station text not null default 'cocina'
  check (station in ('cocina', 'barra'));

alter table order_items
  add column if not exists station text not null default 'cocina'
  check (station in ('cocina', 'barra'));

create index if not exists order_items_station_idx on order_items(station, status, restaurant_id);
