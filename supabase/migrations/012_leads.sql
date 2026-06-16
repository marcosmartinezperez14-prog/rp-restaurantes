-- Leads de pago (pre-Stripe) y contacto/demo.
-- Sin RLS: acceso solo desde service_role en las API routes.

create table if not exists public.leads_pago (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  nombre_restaurante  text not null,
  email               text not null,
  telefono            text not null,
  stripe_session_id   text null,
  estado              text not null default 'iniciado'
                        check (estado in ('iniciado','pagado','fallido')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.leads_contacto (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  nombre_restaurante  text not null,
  email               text not null,
  telefono            text not null,
  mensaje             text null,
  atendido            boolean not null default false,
  created_at          timestamptz not null default now()
);
