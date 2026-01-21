ALTER TABLE tbclienti
  ADD COLUMN IF NOT EXISTS rischio_ver_a text,
  ADD COLUMN IF NOT EXISTS rischio_ver_b text,
  ADD COLUMN IF NOT EXISTS gg_ver_a integer,
  ADD COLUMN IF NOT EXISTS gg_ver_b integer;