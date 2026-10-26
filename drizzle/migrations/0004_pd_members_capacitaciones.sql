ALTER TABLE public.pd_members
  ADD COLUMN cap_m4 boolean NOT NULL DEFAULT false,
  ADD COLUMN cap_edc boolean NOT NULL DEFAULT false,
  ADD COLUMN cap_mary boolean NOT NULL DEFAULT false,
  ADD COLUMN cap_sniper boolean NOT NULL DEFAULT false,
  ADD COLUMN cap_air boolean NOT NULL DEFAULT false,
  ADD COLUMN cap_ak47 boolean NOT NULL DEFAULT false;