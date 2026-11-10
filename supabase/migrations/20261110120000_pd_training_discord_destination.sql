ALTER TABLE public.pd_trainings
ADD COLUMN IF NOT EXISTS discord_published_channel_id text;

CREATE INDEX IF NOT EXISTS pd_trainings_discord_destination_idx
ON public.pd_trainings(discord_published_channel_id)
WHERE discord_published_channel_id IS NOT NULL;
