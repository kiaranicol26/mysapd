-- Keep salary rows linked to a stable Discord/web identity without rewriting history.
-- Existing rows intentionally remain NULL: a name-only backfill could attach payments
-- to the wrong person when names were reused or duplicated.
ALTER TABLE public.salary_entries
  ADD COLUMN IF NOT EXISTS instructor_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'salary_entries_instructor_id_fkey'
      AND conrelid = 'public.salary_entries'::regclass
  ) THEN
    ALTER TABLE public.salary_entries
      ADD CONSTRAINT salary_entries_instructor_id_fkey
      FOREIGN KEY (instructor_id)
      REFERENCES public.instructors(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS salary_entries_instructor_id_idx
  ON public.salary_entries(instructor_id)
  WHERE instructor_id IS NOT NULL;

COMMENT ON COLUMN public.salary_entries.instructor_id IS
  'Stable instructor identity; NULL for legacy or unlinked historical salary rows.';
