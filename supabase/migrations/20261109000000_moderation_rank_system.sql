-- mySAPD administrative moderation hierarchy.
-- Police ranks remain stored in Registro PD and are not changed here.
ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS admin_rango text NOT NULL DEFAULT 'usuario';

-- Every existing account starts as a read-only Usuario, except the three
-- explicitly designated Administradores.
UPDATE public.instructors
SET admin_rango = 'usuario',
    is_alto_mando = false,
    role = 'Usuario';

UPDATE public.instructors
SET admin_rango = 'administrador',
    is_alto_mando = true
WHERE lower(trim(name)) IN ('kiara vacnet', 'kendo', 'mike');

ALTER TABLE public.instructors
  ALTER COLUMN admin_rango SET DEFAULT 'usuario';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instructors_admin_rango_check'
      AND conrelid = 'public.instructors'::regclass
  ) THEN
    ALTER TABLE public.instructors
      ADD CONSTRAINT instructors_admin_rango_check
      CHECK (admin_rango IN ('usuario', 'ayudante', 'moderador', 'administrador'));
  END IF;
END $$;
