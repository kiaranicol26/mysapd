-- Store the Discord forum thread associated with each SAPD member.
ALTER TABLE public.pd_members
  ADD COLUMN IF NOT EXISTS discord_forum_thread_id text;

CREATE INDEX IF NOT EXISTS pd_members_discord_forum_thread_idx
  ON public.pd_members(discord_forum_thread_id)
  WHERE discord_forum_thread_id IS NOT NULL;
