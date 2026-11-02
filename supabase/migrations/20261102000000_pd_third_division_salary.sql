ALTER TABLE public.pd_members
  ADD COLUMN IF NOT EXISTS division3 text,
  ADD COLUMN IF NOT EXISTS division3_rango text;

-- Each assigned division adds +10 Coins. Existing salary rows remain frozen snapshots.
