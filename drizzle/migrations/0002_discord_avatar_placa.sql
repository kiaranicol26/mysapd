ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS sync_avatar boolean NOT NULL DEFAULT true;
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS placa text;