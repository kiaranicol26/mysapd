-- Discord verification codes are only accessed by server-side service-role code.
-- RLS already has no client-facing policies; revoke table grants as defense in depth.
REVOKE ALL PRIVILEGES
  ON TABLE public.discord_verifications
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.discord_verifications ENABLE ROW LEVEL SECURITY;
