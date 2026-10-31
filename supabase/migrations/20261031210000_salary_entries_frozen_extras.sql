-- Freeze the monetary extras on each salary row.
-- Existing linked rows are snapshotted from their currently displayed PD values once;
-- new rows store the extras at creation time. Legacy unlinked rows remain unchanged.
ALTER TABLE public.salary_entries
  ADD COLUMN IF NOT EXISTS extras integer NOT NULL DEFAULT 0;

UPDATE public.salary_entries AS salary
SET paga = pd.sueldo_defecto,
    extras =
  CASE
    WHEN pd.division IS NOT NULL AND pd.division NOT IN ('Ninguna', 'N/A') THEN 15
    ELSE 0
  END
  +
  CASE
    WHEN pd.division2 IS NOT NULL AND pd.division2 NOT IN ('Ninguna', 'N/A') THEN 15
    ELSE 0
  END
  +
  CASE WHEN pd.es_instructor THEN 10 ELSE 0 END
FROM public.pd_members AS pd
WHERE salary.pd_member_id = pd.id;

COMMENT ON COLUMN public.salary_entries.extras IS
  'Snapshot of division and instructor bonuses in Coins at salary row creation; historical values do not follow later PD edits.';
