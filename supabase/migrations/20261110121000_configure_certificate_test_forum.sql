INSERT INTO public.app_settings (key, value)
VALUES ('certificate_forum_channel_id', '1569567016543584276')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
