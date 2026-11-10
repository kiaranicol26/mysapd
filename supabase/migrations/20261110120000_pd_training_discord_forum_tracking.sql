ALTER TABLE public.pd_trainings
ADD COLUMN IF NOT EXISTS discord_published_forum_id text;
