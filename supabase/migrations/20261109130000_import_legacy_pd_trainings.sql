-- Preserve the old SAPD training flags as individual historical training records.
-- Historical metadata that was never stored is intentionally left NULL and shown as "Nada".
ALTER TABLE public.pd_trainings
  ALTER COLUMN awarded_at DROP NOT NULL,
  ALTER COLUMN instructor_pd_member_id DROP NOT NULL,
  ALTER COLUMN created_by_id DROP NOT NULL,
  ALTER COLUMN created_by_name DROP NOT NULL;

ALTER TABLE public.pd_trainings
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;

ALTER TABLE public.pd_trainings
  DROP CONSTRAINT IF EXISTS pd_trainings_training_check;

ALTER TABLE public.pd_trainings
  ADD CONSTRAINT pd_trainings_training_check
  CHECK (training IN ('M4', 'EDC', 'AK-47', 'SNIPER', 'MARY', 'AIR', 'OTRA'));

INSERT INTO public.pd_trainings
  (pd_member_id, section, training, training_other, awarded_at,
   instructor_pd_member_id, created_by_id, created_by_name, is_legacy)
SELECT
  p.id,
  legacy.section,
  legacy.training,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  true
FROM public.pd_members p
CROSS JOIN LATERAL (
  VALUES
    ('Armas'::text, 'M4'::text, COALESCE(p.cap_m4, false)),
    ('Armas'::text, 'EDC'::text, COALESCE(p.cap_edc, false)),
    ('Armas'::text, 'AK-47'::text, COALESCE(p.cap_ak47, false)),
    ('Armas'::text, 'SNIPER'::text, COALESCE(p.cap_sniper, false)),
    ('Vehículos'::text, 'MARY'::text, COALESCE(p.cap_mary, false)),
    ('Vehículos'::text, 'AIR'::text, COALESCE(p.cap_air, false))
) AS legacy(section, training, enabled)
WHERE legacy.enabled = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.pd_trainings existing
    WHERE existing.pd_member_id = p.id
      AND existing.training = legacy.training
      AND existing.is_legacy = true
  );
