/*
# Add Authentication Profiles Infrastructure

## Purpose
Links Supabase Auth users to the existing app data model (donors, mosque_accounts)
so the app can use real Supabase Auth for sign-in, session management, and role
distinction — replacing the fake plaintext-password system.

## New Tables
### profiles
- id (uuid, PK, references auth.users) — the Supabase Auth user
- role (text) — 'donor' or 'mosque' — the app role, set at signup
- donor_id (uuid, nullable, FK → donors) — linked donor record (for donor role)
- mosque_account_id (uuid, nullable, FK → mosque_accounts) — linked mosque account (for mosque role)
- email (text) — denormalized email for quick lookups
- created_at (timestamptz) — creation timestamp
- updated_at (timestamptz) — last update

## Modified Tables
### donors
- Added column auth_id (uuid, nullable) — links to auth.users.id

### mosque_accounts
- Added column auth_id (uuid, nullable) — links to auth.users.id
- Made password_hash nullable (no longer used for auth; Supabase Auth handles passwords)

## Security
- RLS enabled on profiles
- SELECT: users can read their own profile (auth.uid() = id)
- INSERT: users can insert their own profile (auth.uid() = id)
- UPDATE: users can update their own profile (auth.uid() = id)
- DELETE: users can delete their own profile (auth.uid() = id)
- anon SELECT allowed (prototype uses anon key)
- Existing open policies on donors/mosque_accounts preserved (prototype mode)

## Important Notes
1. The `role` column in profiles is the single source of truth for user role.
2. profiles uses auth.uid() = id for ownership — secure because id references auth.users.
3. password_hash on mosque_accounts kept for backward compatibility but unused.
4. A trigger auto-updates updated_at on profile changes.
*/

-- Add auth_id to donors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donors' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE donors ADD COLUMN auth_id uuid;
  END IF;
END $$;

-- Add auth_id to mosque_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mosque_accounts' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE mosque_accounts ADD COLUMN auth_id uuid;
  END IF;
END $$;

-- Make password_hash nullable (no longer used for auth)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mosque_accounts' AND column_name = 'password_hash'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE mosque_accounts ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'donor',
  donor_id uuid REFERENCES donors(id) ON DELETE SET NULL,
  mosque_account_id uuid REFERENCES mosque_accounts(id) ON DELETE SET NULL,
  email text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles
  TO authenticated USING (auth.uid() = id);

-- Allow anon to read profiles (needed for prototype where anon key is used)
DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;
CREATE POLICY "anon_select_profiles" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_donors_auth_id ON donors(auth_id);
CREATE INDEX IF NOT EXISTS idx_mosque_accounts_auth_id ON mosque_accounts(auth_id);

-- Update updated_at on profile changes
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_profile_updated_at ON profiles;
CREATE TRIGGER trigger_update_profile_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();
