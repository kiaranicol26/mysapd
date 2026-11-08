ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS admin_rango text NOT NULL DEFAULT 'usuario';
UPDATE public.instructors SET admin_rango = 'administrador', is_alto_mando = true WHERE name IN ('Kiara Vacnet','Kendo','Mike');
UPDATE public.instructors SET is_alto_mando = false WHERE name NOT IN ('Kiara Vacnet','Kendo','Mike');