-- Independent manual salary module. It does not read or mutate salary_months/salary_entries.
CREATE TABLE IF NOT EXISTS public.manual_salary_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  report_date date,
  raw_text text NOT NULL DEFAULT '',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manual_salary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.manual_salary_batches(id) ON DELETE CASCADE,
  pd_member_id uuid REFERENCES public.pd_members(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  rango_snapshot text,
  actividad text NOT NULL DEFAULT '',
  activity_minutes integer,
  sueldo numeric(14,2) NOT NULL DEFAULT 0,
  nota text,
  pagado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_salary_entries_batch_idx
  ON public.manual_salary_entries(batch_id);
CREATE INDEX IF NOT EXISTS manual_salary_entries_member_idx
  ON public.manual_salary_entries(pd_member_id);

ALTER TABLE public.manual_salary_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_salary_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manual_salary_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.manual_salary_entries FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.manual_salary_batches IS
  'Manual salary liquidations, isolated from the automatic salary module.';
COMMENT ON TABLE public.manual_salary_entries IS
  'Editable manual salary rows with Registro PD identity and rank snapshot.';
