-- Track publication to avoid duplicate certificate posts during resynchronization.
ALTER TABLE public.pd_trainings
  ADD COLUMN IF NOT EXISTS discord_published_at timestamptz;

CREATE INDEX IF NOT EXISTS pd_trainings_discord_unpublished_idx
  ON public.pd_trainings(created_at)
  WHERE discord_published_at IS NULL;
