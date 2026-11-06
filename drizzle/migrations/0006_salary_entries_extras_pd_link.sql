ALTER TABLE public.salary_entries ADD COLUMN IF NOT EXISTS extras numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_entries ADD COLUMN IF NOT EXISTS pd_member_id uuid REFERENCES public.pd_members(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS salary_entries_month_pd_member_uniq ON public.salary_entries(month_id, pd_member_id) WHERE pd_member_id IS NOT NULL;
NOTIFY pgrst, 'reload schema';