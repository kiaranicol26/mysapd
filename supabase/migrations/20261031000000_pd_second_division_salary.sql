ALTER TABLE public.pd_members
  ADD COLUMN IF NOT EXISTS division2 text,
  ADD COLUMN IF NOT EXISTS division2_rango text;

-- Existing individual salaries remain in sueldo_defecto.
-- Division bonuses are calculated by the application at +15 Coins per assigned division.
