-- Separate category system for menu items (carta), independent from product categories

create table if not exists menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name          text not null,
  position      int  not null default 0,
  created_at    timestamptz not null default now()
);

alter table menu_categories enable row level security;

create policy "restaurant members can read menu_categories"
  on menu_categories for select
  using (
    restaurant_id in (
      select restaurant_id from user_restaurants where user_id = auth.uid()
    )
  );

create policy "editors can manage menu_categories"
  on menu_categories for all
  using (
    restaurant_id in (
      select restaurant_id from user_restaurants where user_id = auth.uid()
    )
  );

-- New column on menu_items for the carta category (separate from product category_id)
alter table menu_items add column if not exists menu_category_id uuid references menu_categories(id) on delete set null;

create index if not exists menu_items_menu_category_id_idx on menu_items(menu_category_id);
