ALTER TABLE public.instructors ADD COLUMN discord_id text UNIQUE, ADD COLUMN discord_username text, ADD COLUMN secciones text[] NOT NULL DEFAULT '{}'::text[];
UPDATE public.instructors SET secciones = ARRAY['exsapd','aspirantes','rnap','certificar','registro','lista','forum'];
CREATE TABLE public.discord_verifications (
  discord_id text PRIMARY KEY,
  discord_username text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.discord_verifications TO service_role;
ALTER TABLE public.discord_verifications ENABLE ROW LEVEL SECURITY;