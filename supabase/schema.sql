-- ============================================================
-- Colección Rosita Lira — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- 1.1 Artists
CREATE TABLE artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nationality text,
  birth_year int,
  death_year int,
  bio text,
  bio_source text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.2 Pieces (core table)
CREATE TABLE pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Sin título',
  artist_id uuid REFERENCES artists(id) ON DELETE SET NULL,
  year_created int,
  medium text,
  type_of_art text CHECK (type_of_art IN ('Pintura', 'Escultura', 'Grabado', 'Fotografía', 'Dibujo', 'Mixta', 'Otro')),
  dimensions text,
  location text,
  status text DEFAULT 'Disponible' CHECK (status IN ('Disponible', 'Vendida', 'Donada', 'Perdida', 'Dañada')),
  condition_notes text,
  provenance_notes text,
  description text,
  notes text,
  is_signed boolean DEFAULT false,
  inventory_number text,
  tags text[],
  data_completeness int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pieces_artist ON pieces(artist_id);
CREATE INDEX idx_pieces_location ON pieces(location);
CREATE INDEX idx_pieces_status ON pieces(status);
CREATE INDEX idx_pieces_type ON pieces(type_of_art);
CREATE INDEX idx_pieces_completeness ON pieces(data_completeness);

-- 1.3 Photos
CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  slot int NOT NULL CHECK (slot BETWEEN 1 AND 3),
  thumbnail_path text,
  gdrive_file_id text,
  gdrive_url text,
  is_primary boolean DEFAULT false,
  uploaded_at timestamptz DEFAULT now(),
  UNIQUE(piece_id, slot)
);

CREATE INDEX idx_photos_piece ON photos(piece_id);

-- 1.4 Valuations
CREATE TABLE valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  estimated_value_usd numeric,
  estimated_value_clp numeric,
  value_source text,
  confidence text CHECK (confidence IN ('Alta', 'Media', 'Baja')),
  appraised_by text,
  appraised_at date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_valuations_piece ON valuations(piece_id);

-- 1.5 Wishlists (private per sibling)
CREATE TABLE wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  interest_level int NOT NULL CHECK (interest_level BETWEEN 1 AND 3),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, piece_id)
);

CREATE INDEX idx_wishlists_user ON wishlists(user_id);
CREATE INDEX idx_wishlists_piece ON wishlists(piece_id);

-- 1.6 Allocations (Phase 2 — schema now, UI later)
CREATE TABLE allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL UNIQUE REFERENCES pieces(id) ON DELETE CASCADE,
  heir_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phase text CHECK (phase IN ('auto_resolved', 'sentimental', 'draft', 'unassigned')),
  draft_round int,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz,
  notes text
);

-- 1.7 Activity Log
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'valued', 'photo_added', 'wishlist_marked')),
  entity_type text NOT NULL CHECK (entity_type IN ('piece', 'artist', 'valuation', 'wishlist')),
  entity_id uuid NOT NULL,
  changes jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

-- ============================================================
-- 2. HELPER FUNCTION: get current user's role
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'viewer'
  );
$$;

-- ============================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pieces_updated_at
  BEFORE UPDATE ON pieces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_wishlists_updated_at
  BEFORE UPDATE ON wishlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

-- 4.1 Artists — everyone reads, editor/pricing/admin write
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artists_select" ON artists
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "artists_insert" ON artists
  FOR INSERT TO authenticated
  WITH CHECK (user_role() IN ('admin', 'editor'));

CREATE POLICY "artists_update" ON artists
  FOR UPDATE TO authenticated
  USING (user_role() IN ('admin', 'editor', 'pricing'));

CREATE POLICY "artists_delete" ON artists
  FOR DELETE TO authenticated
  USING (user_role() = 'admin');

-- 4.2 Pieces — everyone reads, role-based writes
ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pieces_select" ON pieces
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "pieces_insert" ON pieces
  FOR INSERT TO authenticated
  WITH CHECK (user_role() IN ('admin', 'editor'));

CREATE POLICY "pieces_update" ON pieces
  FOR UPDATE TO authenticated
  USING (user_role() IN ('admin', 'editor', 'pricing'));

CREATE POLICY "pieces_delete" ON pieces
  FOR DELETE TO authenticated
  USING (user_role() = 'admin');

-- 4.3 Photos — everyone reads, editor/admin write
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON photos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "photos_insert" ON photos
  FOR INSERT TO authenticated
  WITH CHECK (user_role() IN ('admin', 'editor'));

CREATE POLICY "photos_update" ON photos
  FOR UPDATE TO authenticated
  USING (user_role() IN ('admin', 'editor'));

CREATE POLICY "photos_delete" ON photos
  FOR DELETE TO authenticated
  USING (user_role() = 'admin');

-- 4.4 Valuations — everyone reads, editor/pricing/admin write
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "valuations_select" ON valuations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "valuations_insert" ON valuations
  FOR INSERT TO authenticated
  WITH CHECK (user_role() IN ('admin', 'editor', 'pricing'));

CREATE POLICY "valuations_update" ON valuations
  FOR UPDATE TO authenticated
  USING (user_role() IN ('admin', 'editor', 'pricing'));

CREATE POLICY "valuations_delete" ON valuations
  FOR DELETE TO authenticated
  USING (user_role() = 'admin');

-- 4.5 Wishlists — own rows only, admin sees all
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlists_select_own" ON wishlists
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_role() = 'admin'
  );

CREATE POLICY "wishlists_insert_own" ON wishlists
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND user_role() IN ('admin', 'editor', 'viewer')
  );

CREATE POLICY "wishlists_update_own" ON wishlists
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "wishlists_delete_own" ON wishlists
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4.6 Allocations — everyone reads, admin writes
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allocations_select" ON allocations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "allocations_insert" ON allocations
  FOR INSERT TO authenticated
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "allocations_update" ON allocations
  FOR UPDATE TO authenticated
  USING (user_role() = 'admin');

CREATE POLICY "allocations_delete" ON allocations
  FOR DELETE TO authenticated
  USING (user_role() = 'admin');

-- 4.7 Activity Log — everyone reads, system writes (via service role or authenticated)
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_select" ON activity_log
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 5. STORAGE BUCKET
-- ============================================================

-- Create the thumbnails bucket (public read for displaying images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload, everyone can read
CREATE POLICY "thumbnails_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'thumbnails');

CREATE POLICY "thumbnails_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "thumbnails_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'thumbnails');

CREATE POLICY "thumbnails_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'thumbnails' AND (SELECT user_role()) = 'admin');

-- ============================================================
-- 6. VIEWS (convenience queries)
-- ============================================================

-- Pieces with artist name and latest valuation
CREATE OR REPLACE VIEW pieces_with_details AS
SELECT
  p.*,
  a.name AS artist_name,
  a.nationality AS artist_nationality,
  v.estimated_value_usd AS latest_value_usd,
  v.estimated_value_clp AS latest_value_clp,
  v.confidence AS latest_confidence,
  v.value_source AS latest_value_source,
  ph.thumbnail_path AS primary_thumbnail
FROM pieces p
LEFT JOIN artists a ON p.artist_id = a.id
LEFT JOIN LATERAL (
  SELECT estimated_value_usd, estimated_value_clp, confidence, value_source
  FROM valuations
  WHERE piece_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) v ON true
LEFT JOIN photos ph ON ph.piece_id = p.id AND ph.is_primary = true;
