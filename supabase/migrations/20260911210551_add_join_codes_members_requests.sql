/*
# Add join codes, mosque members, and donor requests

1. Modified Tables
   - `mosques`: add `join_code` (text, unique) — code donors must enter to join a mosque

2. New Tables
   - `mosque_members` — tracks which donors belong to which mosques
     - `id` (uuid, PK)
     - `donor_id` (uuid, FK → donors)
     - `mosque_id` (uuid, FK → mosques)
     - `joined_at` (timestamptz)
     - UNIQUE(donor_id, mosque_id)

   - `donor_requests` — donors can request items/services from their mosque
     - `id` (uuid, PK)
     - `donor_id` (uuid, FK → donors)
     - `mosque_id` (uuid, FK → mosques)
     - `title` (text, not null)
     - `description` (text, nullable)
     - `created_at` (timestamptz)

3. Security
   - RLS enabled on both new tables
   - Open anon+authenticated policies (custom email-based identity, no Supabase Auth)

4. Notes
   - join_code is generated at mosque creation or can be changed by the mosque manager
   - mosque_members replaces the open-browse model with a code-gated membership
   - donor_requests are one-way: donors submit, mosque reads (no reply)
*/

-- Add join_code to mosques
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mosques' AND column_name = 'join_code'
  ) THEN
    ALTER TABLE mosques ADD COLUMN join_code text UNIQUE;
  END IF;
END $$;

-- mosque_members
CREATE TABLE IF NOT EXISTS mosque_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  mosque_id uuid NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(donor_id, mosque_id)
);

ALTER TABLE mosque_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_mosque_members" ON mosque_members;
CREATE POLICY "anon_select_mosque_members" ON mosque_members FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mosque_members" ON mosque_members;
CREATE POLICY "anon_insert_mosque_members" ON mosque_members FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mosque_members" ON mosque_members;
CREATE POLICY "anon_update_mosque_members" ON mosque_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mosque_members" ON mosque_members;
CREATE POLICY "anon_delete_mosque_members" ON mosque_members FOR DELETE TO anon, authenticated USING (true);

-- donor_requests
CREATE TABLE IF NOT EXISTS donor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  mosque_id uuid NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE donor_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_donor_requests" ON donor_requests;
CREATE POLICY "anon_select_donor_requests" ON donor_requests FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_donor_requests" ON donor_requests;
CREATE POLICY "anon_insert_donor_requests" ON donor_requests FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_donor_requests" ON donor_requests;
CREATE POLICY "anon_update_donor_requests" ON donor_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_donor_requests" ON donor_requests;
CREATE POLICY "anon_delete_donor_requests" ON donor_requests FOR DELETE TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mosque_members_donor ON mosque_members(donor_id);
CREATE INDEX IF NOT EXISTS idx_mosque_members_mosque ON mosque_members(mosque_id);
CREATE INDEX IF NOT EXISTS idx_donor_requests_mosque ON donor_requests(mosque_id);
CREATE INDEX IF NOT EXISTS idx_donor_requests_donor ON donor_requests(donor_id);
CREATE INDEX IF NOT EXISTS idx_mosques_join_code ON mosques(join_code);
