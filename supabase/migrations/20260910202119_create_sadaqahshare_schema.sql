/*
# SadaqahShare — Full Database Schema

## New Tables

### mosques
- id (uuid, PK) — unique mosque identifier
- name (text) — mosque name
- address (text) — street address
- city (text) — city
- state (text) — state/province
- phone (text, nullable) — contact phone
- email (text, nullable) — public contact email
- description (text, nullable) — community description
- image_url (text, nullable) — remote image URL
- created_at (timestamptz) — creation timestamp

### needs
- id (uuid, PK) — unique need identifier
- mosque_id (uuid, FK → mosques) — owning mosque
- name (text) — need/item name
- description (text, nullable) — details
- category (text) — Furnishings, Appliances, Food, Educational, Clothing, Medical, Supplies, General
- quantity_needed (int) — total quantity required
- quantity_pledged (int, default 0) — quantity pledged so far
- priority (text) — Urgent, High, Medium, Low
- purchase_link (text, nullable) — sourcing URL
- tokens_per_unit (int) — tokens awarded per unit donated
- type (text, default 'item') — 'item' or 'money'
- amount_dollars (numeric, nullable) — dollar amount per unit for money needs
- created_at (timestamptz) — creation timestamp

### donors
- id (uuid, PK) — unique donor identifier
- email (text, unique) — donor email (login identity)
- name (text) — donor display name
- token_balance (int, default 0) — legacy global token balance
- is_member (boolean, default false) — membership flag
- created_at (timestamptz) — creation timestamp

### donor_mosque_tokens
- id (uuid, PK) — row identifier
- donor_id (uuid, FK → donors) — donor
- mosque_id (uuid, FK → mosques) — mosque
- token_balance (int, default 0) — tokens at this mosque
- UNIQUE(donor_id, mosque_id)

### pledges
- id (uuid, PK) — unique pledge identifier
- need_id (uuid, FK → needs) — associated need
- donor_id (uuid, FK → donors) — pledging donor
- donor_name (text) — donor name at time of pledge
- donor_email (text) — donor email at time of pledge
- quantity (int) — pledged quantity
- delivery_method (text, nullable) — 'ship' or 'dropoff'
- status (text, default 'pending') — pending, fulfilled, cancelled
- notes (text, nullable) — donor notes
- tokens_earned (int, default 0) — tokens awarded for this pledge
- created_at (timestamptz) — creation timestamp

### polls
- id (uuid, PK) — unique poll identifier
- mosque_id (uuid, FK → mosques) — owning mosque
- question (text) — poll question
- description (text, nullable) — optional description
- status (text, default 'active') — active or closed
- tokens_to_vote (int, default 5) — token cost per vote
- max_votes_per_person (int, default 1) — max votes per donor
- closes_at (timestamptz, nullable) — auto-close time
- created_at (timestamptz) — creation timestamp

### poll_options
- id (uuid, PK) — unique option identifier
- poll_id (uuid, FK → polls) — parent poll
- option_text (text) — option label
- created_at (timestamptz) — creation timestamp

### votes
- id (uuid, PK) — unique vote identifier
- donor_id (uuid, FK → donors) — voting donor
- poll_id (uuid, FK → polls) — target poll
- option_id (uuid, FK → poll_options) — selected option
- tokens_spent (int, default 0) — tokens consumed
- created_at (timestamptz) — creation timestamp

### mosque_accounts
- id (uuid, PK) — unique account identifier
- mosque_id (uuid, FK → mosques, unique) — linked mosque
- email (text, unique) — login email
- password_hash (text) — password (prototype stores plain text)
- is_paid (boolean, default false) — subscription status
- created_at (timestamptz) — creation timestamp

## Security
- RLS enabled on ALL tables
- All tables use anon + authenticated policies (no Supabase Auth, email-based identity)
- Policies allow full CRUD for anon and authenticated roles (prototype/demo mode)

## Notes
1. This is a prototype schema — production would use Supabase Auth and restrictive RLS
2. donor_mosque_tokens has a unique constraint on (donor_id, mosque_id)
3. needs.type distinguishes physical items from monetary fundraisers
4. votes allows multiple rows per donor/poll (for max_votes_per_person > 1)
*/

-- mosques
CREATE TABLE IF NOT EXISTS mosques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  phone text,
  email text,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mosques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_mosques" ON mosques;
CREATE POLICY "anon_select_mosques" ON mosques FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mosques" ON mosques;
CREATE POLICY "anon_insert_mosques" ON mosques FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mosques" ON mosques;
CREATE POLICY "anon_update_mosques" ON mosques FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mosques" ON mosques;
CREATE POLICY "anon_delete_mosques" ON mosques FOR DELETE TO anon, authenticated USING (true);

-- needs
CREATE TABLE IF NOT EXISTS needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id uuid NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  quantity_needed int NOT NULL DEFAULT 1,
  quantity_pledged int NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'Medium',
  purchase_link text,
  tokens_per_unit int NOT NULL DEFAULT 10,
  type text NOT NULL DEFAULT 'item',
  amount_dollars numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE needs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_needs" ON needs;
CREATE POLICY "anon_select_needs" ON needs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_needs" ON needs;
CREATE POLICY "anon_insert_needs" ON needs FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_needs" ON needs;
CREATE POLICY "anon_update_needs" ON needs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_needs" ON needs;
CREATE POLICY "anon_delete_needs" ON needs FOR DELETE TO anon, authenticated USING (true);

-- donors
CREATE TABLE IF NOT EXISTS donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  token_balance int NOT NULL DEFAULT 0,
  is_member boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE donors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_donors" ON donors;
CREATE POLICY "anon_select_donors" ON donors FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_donors" ON donors;
CREATE POLICY "anon_insert_donors" ON donors FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_donors" ON donors;
CREATE POLICY "anon_update_donors" ON donors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_donors" ON donors;
CREATE POLICY "anon_delete_donors" ON donors FOR DELETE TO anon, authenticated USING (true);

-- donor_mosque_tokens
CREATE TABLE IF NOT EXISTS donor_mosque_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  mosque_id uuid NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  token_balance int NOT NULL DEFAULT 0,
  UNIQUE(donor_id, mosque_id)
);

ALTER TABLE donor_mosque_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_dmt" ON donor_mosque_tokens;
CREATE POLICY "anon_select_dmt" ON donor_mosque_tokens FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_dmt" ON donor_mosque_tokens;
CREATE POLICY "anon_insert_dmt" ON donor_mosque_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_dmt" ON donor_mosque_tokens;
CREATE POLICY "anon_update_dmt" ON donor_mosque_tokens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_dmt" ON donor_mosque_tokens;
CREATE POLICY "anon_delete_dmt" ON donor_mosque_tokens FOR DELETE TO anon, authenticated USING (true);

-- pledges
CREATE TABLE IF NOT EXISTS pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  donor_name text NOT NULL,
  donor_email text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  delivery_method text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  tokens_earned int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pledges" ON pledges;
CREATE POLICY "anon_select_pledges" ON pledges FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pledges" ON pledges;
CREATE POLICY "anon_insert_pledges" ON pledges FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pledges" ON pledges;
CREATE POLICY "anon_update_pledges" ON pledges FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pledges" ON pledges;
CREATE POLICY "anon_delete_pledges" ON pledges FOR DELETE TO anon, authenticated USING (true);

-- polls
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id uuid NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  question text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  tokens_to_vote int NOT NULL DEFAULT 5,
  max_votes_per_person int NOT NULL DEFAULT 1,
  closes_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_polls" ON polls;
CREATE POLICY "anon_select_polls" ON polls FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_polls" ON polls;
CREATE POLICY "anon_insert_polls" ON polls FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_polls" ON polls;
CREATE POLICY "anon_update_polls" ON polls FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_polls" ON polls;
CREATE POLICY "anon_delete_polls" ON polls FOR DELETE TO anon, authenticated USING (true);

-- poll_options
CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_poll_options" ON poll_options;
CREATE POLICY "anon_select_poll_options" ON poll_options FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_poll_options" ON poll_options;
CREATE POLICY "anon_insert_poll_options" ON poll_options FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_poll_options" ON poll_options;
CREATE POLICY "anon_update_poll_options" ON poll_options FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_poll_options" ON poll_options;
CREATE POLICY "anon_delete_poll_options" ON poll_options FOR DELETE TO anon, authenticated USING (true);

-- votes
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  tokens_spent int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_votes" ON votes;
CREATE POLICY "anon_select_votes" ON votes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_votes" ON votes;
CREATE POLICY "anon_insert_votes" ON votes FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_votes" ON votes;
CREATE POLICY "anon_update_votes" ON votes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_votes" ON votes;
CREATE POLICY "anon_delete_votes" ON votes FOR DELETE TO anon, authenticated USING (true);

-- mosque_accounts
CREATE TABLE IF NOT EXISTS mosque_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id uuid UNIQUE NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mosque_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_mosque_accounts" ON mosque_accounts;
CREATE POLICY "anon_select_mosque_accounts" ON mosque_accounts FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mosque_accounts" ON mosque_accounts;
CREATE POLICY "anon_insert_mosque_accounts" ON mosque_accounts FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mosque_accounts" ON mosque_accounts;
CREATE POLICY "anon_update_mosque_accounts" ON mosque_accounts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mosque_accounts" ON mosque_accounts;
CREATE POLICY "anon_delete_mosque_accounts" ON mosque_accounts FOR DELETE TO anon, authenticated USING (true);

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_needs_mosque_id ON needs(mosque_id);
CREATE INDEX IF NOT EXISTS idx_pledges_need_id ON pledges(need_id);
CREATE INDEX IF NOT EXISTS idx_pledges_donor_id ON pledges(donor_id);
CREATE INDEX IF NOT EXISTS idx_polls_mosque_id ON polls(mosque_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_poll_id ON votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_donor_id ON votes(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_mosque_tokens_donor ON donor_mosque_tokens(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_mosque_tokens_mosque ON donor_mosque_tokens(mosque_id);
CREATE INDEX IF NOT EXISTS idx_mosque_accounts_email ON mosque_accounts(email);
CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(email);
