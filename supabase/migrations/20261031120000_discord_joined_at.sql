ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS discord_joined_at timestamptz;

COMMENT ON COLUMN public.instructors.discord_joined_at IS
  'Fecha en que el miembro ingresó al servidor de Discord de la facción.';
