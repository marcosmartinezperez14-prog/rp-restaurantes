ALTER TABLE public.leads_pago
  ADD COLUMN IF NOT EXISTS plan_interes text null;
