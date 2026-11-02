ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS can_edit_capacitaciones boolean NOT NULL DEFAULT false;
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS tag text;