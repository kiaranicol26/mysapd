-- Atomically rate-limit code issuance and verify/consume one-time Discord codes.
-- These SECURITY DEFINER functions are callable only by the server service role.

-- Keep the help-message endpoint from being abused to spam Discord members.
CREATE TABLE IF NOT EXISTS public.discord_recovery_requests (
  discord_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discord_recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.discord_recovery_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_discord_recovery(p_discord_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  previous_created_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_discord_id, 1));

  SELECT created_at INTO previous_created_at
    FROM public.discord_recovery_requests
   WHERE discord_id = p_discord_id
   FOR UPDATE;

  IF FOUND AND previous_created_at > now() - interval '60 seconds' THEN
    RETURN false;
  END IF;

  INSERT INTO public.discord_recovery_requests (discord_id, created_at)
  VALUES (p_discord_id, now())
  ON CONFLICT (discord_id) DO UPDATE SET created_at = EXCLUDED.created_at;

  RETURN true;
END;
$;

REVOKE ALL ON FUNCTION public.reserve_discord_recovery(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_discord_recovery(text) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_discord_verification(
  p_discord_id text,
  p_discord_username text,
  p_code_hash text,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_created_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_discord_id, 0));

  SELECT created_at INTO previous_created_at
    FROM public.discord_verifications
   WHERE discord_id = p_discord_id
   FOR UPDATE;

  IF FOUND AND previous_created_at > now() - interval '60 seconds' THEN
    RETURN false;
  END IF;

  INSERT INTO public.discord_verifications (
    discord_id, discord_username, code_hash, attempts, expires_at, created_at
  )
  VALUES (p_discord_id, p_discord_username, p_code_hash, 0, p_expires_at, now())
  ON CONFLICT (discord_id) DO UPDATE SET
    discord_username = EXCLUDED.discord_username,
    code_hash = EXCLUDED.code_hash,
    attempts = 0,
    expires_at = EXCLUDED.expires_at,
    created_at = EXCLUDED.created_at;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_discord_login_code(
  p_discord_username text,
  p_code_hash text,
  p_consume boolean DEFAULT true
)
RETURNS TABLE (discord_id text, discord_username text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  verification public.discord_verifications%ROWTYPE;
BEGIN
  SELECT * INTO verification
    FROM public.discord_verifications
   WHERE discord_username = p_discord_username
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::text, 'missing'::text;
    RETURN;
  END IF;

  IF verification.expires_at <= now() THEN
    RETURN QUERY SELECT verification.discord_id, verification.discord_username, 'expired'::text;
    RETURN;
  END IF;

  IF verification.attempts >= 5 THEN
    RETURN QUERY SELECT verification.discord_id, verification.discord_username, 'locked'::text;
    RETURN;
  END IF;

  IF verification.code_hash <> p_code_hash THEN
    UPDATE public.discord_verifications
       SET attempts = attempts + 1
     WHERE discord_id = verification.discord_id;
    RETURN QUERY SELECT verification.discord_id, verification.discord_username, 'invalid'::text;
    RETURN;
  END IF;

  IF p_consume THEN
    DELETE FROM public.discord_verifications WHERE discord_id = verification.discord_id;
  END IF;

  RETURN QUERY SELECT verification.discord_id, verification.discord_username, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_discord_verification(text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_discord_login_code(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_discord_verification(text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_discord_login_code(text, text, boolean) TO service_role;
