/*
# Content Management: Archive columns, updated_at, Announcements table

## Overview
This migration adds consistent content-management infrastructure across all
user-created content types in SadaqahShare. It introduces:
1. `archived` boolean + `archived_at` timestamp on content tables
2. `updated_at` timestamp on content tables (to distinguish create vs edit)
3. A new `announcements` table for mosque announcements
4. Realtime publication for the new table

## Modified Tables

### needs
- `archived` (boolean, default false) — soft-archive flag
- `archived_at` (timestamptz, nullable) — when the need was archived
- `updated_at` (timestamptz, default now()) — last modification time

### polls
- `archived` (boolean, default false) — soft-archive flag
- `archived_at` (timestamptz, nullable) — when the poll was archived
- `updated_at` (timestamptz, default now()) — last modification time

### donor_requests
- `archived` (boolean, default false) — soft-archive flag
- `archived_at` (timestamptz, nullable) — when the request was archived
- `updated_at` (timestamptz, default now()) — last modification time
- `status` (text, default 'active') — 'active', 'reviewed', or 'archived'
  (Note: the `archived` boolean is the primary archive flag; `status` is
  used by the mosque to mark a suggestion as reviewed without archiving it.)

## New Tables

### announcements
- `id` (uuid, PK) — unique announcement identifier
- `mosque_id` (uuid, FK → mosques, ON DELETE CASCADE) — owning mosque
- `title` (text, not null) — announcement headline
- `body` (text, nullable) — announcement body content
- `pinned` (boolean, default false) — whether it appears at the top
- `archived` (boolean, default false) — soft-archive flag
- `archived_at` (timestamptz, nullable) — when archived
- `created_at` (timestamptz, default now()) — creation timestamp
- `updated_at` (timestamptz, default now()) — last modification time

## Security
- RLS enabled on `announcements` with full anon+authenticated CRUD
  (same pattern as all other tables in this prototype)
- No changes to existing table RLS policies (new columns are accessible
  under existing open policies)

## Notes
1. All `archived` columns default to `false` so existing rows remain visible
2. `updated_at` defaults to `now()` so existing rows get a sensible value
3. The `announcements` table follows the same column pattern as other content
4. `pinned` allows mosques to highlight important announcements
5. `donor_requests.status` is added so mosques can mark suggestions as reviewed
   without deleting them — preserving the audit trail
*/

-- Add archived + updated_at to needs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'needs' AND column_name = 'archived') THEN
    ALTER TABLE needs ADD COLUMN archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'needs' AND column_name = 'archived_at') THEN
    ALTER TABLE needs ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'needs' AND column_name = 'updated_at') THEN
    ALTER TABLE needs ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add archived + updated_at to polls
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'archived') THEN
    ALTER TABLE polls ADD COLUMN archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'archived_at') THEN
    ALTER TABLE polls ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'updated_at') THEN
    ALTER TABLE polls ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add archived + updated_at + status to donor_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donor_requests' AND column_name = 'archived') THEN
    ALTER TABLE donor_requests ADD COLUMN archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donor_requests' AND column_name = 'archived_at') THEN
    ALTER TABLE donor_requests ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donor_requests' AND column_name = 'updated_at') THEN
    ALTER TABLE donor_requests ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donor_requests' AND column_name = 'status') THEN
    ALTER TABLE donor_requests ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id uuid NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_announcements" ON announcements;
CREATE POLICY "anon_select_announcements" ON announcements FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_announcements" ON announcements;
CREATE POLICY "anon_insert_announcements" ON announcements FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_announcements" ON announcements;
CREATE POLICY "anon_update_announcements" ON announcements FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_announcements" ON announcements;
CREATE POLICY "anon_delete_announcements" ON announcements FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_announcements_mosque ON announcements(mosque_id);
CREATE INDEX IF NOT EXISTS idx_announcements_archived ON announcements(archived);
CREATE INDEX IF NOT EXISTS idx_needs_archived ON needs(archived);
CREATE INDEX IF NOT EXISTS idx_polls_archived ON polls(archived);
CREATE INDEX IF NOT EXISTS idx_donor_requests_archived ON donor_requests(archived);

-- Add announcements to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;