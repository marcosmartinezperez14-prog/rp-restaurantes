ALTER TABLE public.leads_pago
  ADD COLUMN IF NOT EXISTS periodicidad integer null
    CHECK (periodicidad IN (1, 6, 12));
