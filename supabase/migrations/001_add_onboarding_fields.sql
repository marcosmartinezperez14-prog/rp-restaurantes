-- Añade campos de onboarding y datos del restaurante a la tabla restaurants

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step      INT     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS address              TEXT,
  ADD COLUMN IF NOT EXISTS phone                TEXT,
  ADD COLUMN IF NOT EXISTS schedule             TEXT;
