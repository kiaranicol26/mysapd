-- Keep salary rows linked to the exact PD roster record without rewriting history.
-- Existing rows intentionally remain NULL: a name-only backfill could attach payments
-- to the wrong person when names were reused or duplicated.
ALTER TABLE public.salary_entries
  ADD COLUMN IF NOT EXISTS pd_member_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'salary_entries_pd_member_id_fkey'
      AND conrelid = 'public.salary_entries'::regclass
  ) THEN
    ALTER TABLE public.salary_entries
      ADD CONSTRAINT salary_entries_pd_member_id_fkey
      FOREIGN KEY (pd_member_id)
      REFERENCES public.pd_members(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS salary_entries_month_pd_member_unique
  ON public.salary_entries(month_id, pd_member_id)
  WHERE pd_member_id IS NOT NULL;

COMMENT ON COLUMN public.salary_entries.pd_member_id IS
  'Stable Registro PD row identity; NULL for legacy or unlinked historical salary rows.';
