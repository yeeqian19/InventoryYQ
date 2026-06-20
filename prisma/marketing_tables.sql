-- Creates the marketing inventory tables in inv_db.
-- Safe to re-run: uses IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.fa_marketing_items (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL UNIQUE,
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fa_marketing_inventory (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID         NOT NULL,
  item_id     UUID         NOT NULL REFERENCES public.fa_marketing_items(id) ON DELETE CASCADE,
  in_stock    INTEGER      NOT NULL DEFAULT 0,
  registered  INTEGER      NOT NULL DEFAULT 0,
  buffer      INTEGER      NOT NULL DEFAULT 0,
  in_cart     INTEGER      NOT NULL DEFAULT 0,
  ordered     INTEGER      NOT NULL DEFAULT 0,
  no_show     INTEGER      NOT NULL DEFAULT 0,
  walk_in     INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_fa_marketing_inventory_event ON public.fa_marketing_inventory(event_id);

-- Seed the 4 default items (no-op if they already exist)
INSERT INTO public.fa_marketing_items (name, is_default) VALUES
  ('Certificate', TRUE),
  ('Medal',       TRUE),
  ('Sash',        TRUE),
  ('Microphone',  TRUE)
ON CONFLICT (name) DO NOTHING;
