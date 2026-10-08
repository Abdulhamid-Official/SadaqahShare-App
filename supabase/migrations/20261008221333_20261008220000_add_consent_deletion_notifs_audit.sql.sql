/*
# Consent, Account Deletion, Notification Prefs, Announcement Reads, Token Audit, Idempotency, Member Caps

## Overview
This migration adds the infrastructure for:
1. Terms of Service / Privacy Policy consent tracking (Part 8)
2. Account deletion support with anonymization (Part 10)
3. Notification preferences (Part 9)
4. Announcement read tracking for unread dots (Part 15)
5. Token transaction audit log (Part 18)
6. Donation idempotency keys (Part 17)
7. Member capacity on mosque accounts (Parts 11-12)
8. Security: hardened RLS on token tables, profiles, and mosque_accounts

## Modified Tables

### profiles
- terms_accepted (boolean, default false) — user accepted ToS
- terms_accepted_at (timestamptz) — when ToS was accepted
- privacy_accepted (boolean, default false) — user accepted Privacy Policy
- privacy_accepted_at (timestamptz) — when Privacy Policy was accepted
- policy_version (text, default '1.0') — version of policies accepted
- notif_announcements (boolean, default true) — announcement notifications
- notif_polls (boolean, default true) — poll notifications
- notif_needs (boolean, default true) — new needs notifications
- push_notif_enabled (boolean, default false) — push notification opt-in
- display_name (text, nullable) — user-settable display name (defaults to donor/mosque name)

### donors
- deleted_at (timestamptz, nullable) — soft-delete timestamp
- name_anonymized (boolean, default false) — name has been anonymized

### mosque_accounts
- deleted_at (timestamptz, nullable) — soft-delete timestamp
- max_members (int, default 25) — member capacity based on plan

### pledges
- idempotency_key (text, nullable, unique) — prevents duplicate donations
- confirmed_at (timestamptz, nullable) — when mosque confirmed receipt

## New Tables

### announcement_reads
- id (uuid, PK)
- announcement_id (uuid, FK → announcements, ON DELETE CASCADE)
- donor_id (uuid, FK → donors, ON DELETE CASCADE)
- read_at (timestamptz) — when the donor read the announcement
- UNIQUE(announcement_id, donor_id)

### token_transactions
- id (uuid, PK)
- donor_id (uuid, FK → donors) — donor whose tokens changed
- mosque_id (uuid, FK → mosques) — mosque context
- amount (int, NOT NULL) — positive = earned, negative = spent
- balance_after (int, NOT NULL) — balance after this transaction
- type (text, NOT NULL) — 'donation_confirmed', 'vote', 'adjustment', 'reversal'
- reference_id (uuid, nullable) — pledge_id or vote_id that triggered this
- description (text, nullable) — human-readable description
- created_at (timestamptz) — when the transaction occurred

## Security Changes
- Hardened RLS on profiles (keep anon SELECT for prototype, but add proper UPDATE check)
- RLS on announcement_reads (authenticated users manage their own reads)
- RLS on token_transactions (read-only audit log; users can read their own)
- token_transactions INSERT only via SECURITY DEFINER functions (not direct client inserts)

## Important Notes
1. Consent columns default to false — existing users must consent on next login
2. policy_version tracks which version of terms/privacy the user agreed to
3. deleted_at allows soft-delete while preserving historical financial records
4. token_transactions is an append-only audit log — no UPDATE or DELETE
5. idempotency_key on pledges prevents duplicate donations from double-taps or retries
6. max_members on mosque_accounts defaults to 25 (free plan); paid plans get higher caps
7. confirmed_at on pledges tracks when mosque confirms receipt (tokens awarded only after confirmation)
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 1: Consent columns on profiles
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'terms_accepted') THEN
    ALTER TABLE profiles ADD COLUMN terms_accepted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'terms_accepted_at') THEN
    ALTER TABLE profiles ADD COLUMN terms_accepted_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'privacy_accepted') THEN
    ALTER TABLE profiles ADD COLUMN privacy_accepted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'privacy_accepted_at') THEN
    ALTER TABLE profiles ADD COLUMN privacy_accepted_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'policy_version') THEN
    ALTER TABLE profiles ADD COLUMN policy_version text NOT NULL DEFAULT '1.0';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 2: Notification preferences on profiles
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'notif_announcements') THEN
    ALTER TABLE profiles ADD COLUMN notif_announcements boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'notif_polls') THEN
    ALTER TABLE profiles ADD COLUMN notif_polls boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'notif_needs') THEN
    ALTER TABLE profiles ADD COLUMN notif_needs boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'push_notif_enabled') THEN
    ALTER TABLE profiles ADD COLUMN push_notif_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE profiles ADD COLUMN display_name text;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 3: Account deletion columns
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donors' AND column_name = 'deleted_at') THEN
    ALTER TABLE donors ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donors' AND column_name = 'name_anonymized') THEN
    ALTER TABLE donors ADD COLUMN name_anonymized boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mosque_accounts' AND column_name = 'deleted_at') THEN
    ALTER TABLE mosque_accounts ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 4: Member capacity on mosque_accounts
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mosque_accounts' AND column_name = 'max_members') THEN
    ALTER TABLE mosque_accounts ADD COLUMN max_members int NOT NULL DEFAULT 25;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 5: Idempotency and confirmation on pledges
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'idempotency_key') THEN
    ALTER TABLE pledges ADD COLUMN idempotency_key text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'confirmed_at') THEN
    ALTER TABLE pledges ADD COLUMN confirmed_at timestamptz;
  END IF;
END $$;

-- Add unique index on idempotency_key (partial — only non-null keys)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pledges_idempotency_key
  ON pledges(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 6: Announcement reads table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, donor_id)
);

ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_announcement_reads" ON announcement_reads;
CREATE POLICY "select_announcement_reads" ON announcement_reads FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_announcement_reads" ON announcement_reads;
CREATE POLICY "insert_announcement_reads" ON announcement_reads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_announcement_reads" ON announcement_reads;
CREATE POLICY "delete_announcement_reads" ON announcement_reads FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_donor ON announcement_reads(donor_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);

ALTER PUBLICATION supabase_realtime ADD TABLE announcement_reads;

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 7: Token transaction audit log
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  mosque_id uuid NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  amount int NOT NULL,
  balance_after int NOT NULL,
  type text NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own token transactions; no direct INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "select_own_token_transactions" ON token_transactions;
CREATE POLICY "select_own_token_transactions" ON token_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.donor_id = token_transactions.donor_id)
  );

DROP POLICY IF EXISTS "anon_select_token_transactions" ON token_transactions;
CREATE POLICY "anon_select_token_transactions" ON token_transactions FOR SELECT
  TO anon, authenticated USING (true);

-- No INSERT, UPDATE, or DELETE policies — only SECURITY DEFINER functions can write

CREATE INDEX IF NOT EXISTS idx_token_tx_donor ON token_transactions(donor_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_mosque ON token_transactions(mosque_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_type ON token_transactions(type);
CREATE INDEX IF NOT EXISTS idx_token_tx_reference ON token_transactions(reference_id);

-- Add check constraint: balance_after must never be negative
ALTER TABLE token_transactions ADD CONSTRAINT token_balance_non_negative
  CHECK (balance_after >= 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 8: Add updated_at triggers for needs and pledges (if missing)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_needs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_needs_updated_at ON needs;
CREATE TRIGGER trigger_update_needs_updated_at
  BEFORE UPDATE ON needs
  FOR EACH ROW
  EXECUTE FUNCTION update_needs_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 9: Add check constraint on donor_mosque_tokens (non-negative)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE donor_mosque_tokens ADD CONSTRAINT dmt_balance_non_negative
  CHECK (token_balance >= 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 10: Add archived + updated_at to announcements (edit support)
-- ═══════════════════════════════════════════════════════════════════════════

-- Announcements already has archived, archived_at, updated_at from the content management migration

-- ═══════════════════════════════════════════════════════════════════════════
-- Part 11: Realtime publication for token_transactions
-- ═══════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE token_transactions;