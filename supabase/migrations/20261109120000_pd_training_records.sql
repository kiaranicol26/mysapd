-- Permanent numeric personnel file number (legajo) for every SAPD member.
CREATE SEQUENCE IF NOT EXISTS public.pd_member_legajo_seq;

ALTER TABLE public.pd_members
  ADD COLUMN IF NOT EXISTS legajo integer;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS FIRST, id) AS n
  FROM public.pd_members
  WHERE legajo IS NULL
)
UPDATE public.pd_members p
SET legajo = numbered.n
FROM numbered
WHERE p.id = numbered.id;

SELECT setval(
  'public.pd_member_legajo_seq',
  GREATEST(COALESCE((SELECT MAX(legajo) FROM public.pd_members), 0) + 1, 1),
  false
);

ALTER TABLE public.pd_members
  ALTER COLUMN legajo SET DEFAULT nextval('public.pd_member_legajo_seq'),
  ALTER COLUMN legajo SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pd_members_legajo_unique ON public.pd_members(legajo);

CREATE TABLE IF NOT EXISTS public.pd_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pd_member_id uuid NOT NULL REFERENCES public.pd_members(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('Armas', 'Vehículos')),
  training text NOT NULL CHECK (training IN ('M4', 'EDC', 'AK-47', 'SNIPER', 'OTRA')),
  training_other text,
  awarded_at date NOT NULL,
  instructor_pd_member_id uuid NOT NULL REFERENCES public.pd_members(id) ON DELETE RESTRICT,
  created_by_id text NOT NULL REFERENCES public.instructors(id) ON DELETE RESTRICT,
  created_by_name text NOT NULL,
  certificate_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pd_trainings_other_name CHECK (
    (training = 'OTRA' AND length(trim(COALESCE(training_other, ''))) > 0)
    OR (training <> 'OTRA' AND training_other IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS pd_trainings_member_idx ON public.pd_trainings(pd_member_id);
CREATE INDEX IF NOT EXISTS pd_trainings_awarded_idx ON public.pd_trainings(awarded_at DESC);

CREATE OR REPLACE FUNCTION public.validate_pd_training_instructor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pd_members
    WHERE id = NEW.instructor_pd_member_id AND es_instructor = true
  ) THEN
    RAISE EXCEPTION 'El instructor debe pertenecer a la División de Instructores.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pd_trainings_validate_instructor ON public.pd_trainings;
CREATE TRIGGER pd_trainings_validate_instructor
BEFORE INSERT OR UPDATE OF instructor_pd_member_id ON public.pd_trainings
FOR EACH ROW EXECUTE FUNCTION public.validate_pd_training_instructor();

ALTER TABLE public.pd_trainings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read PD trainings" ON public.pd_trainings;
CREATE POLICY "Public can read PD trainings" ON public.pd_trainings FOR SELECT USING (true);
