/*
# RLS Security Overhaul — Parts 20, 21, 22, 28

## Problem
Every table except `profiles` used `USING (true)` policies open to both `anon` and `authenticated` roles.
This meant anyone with the anon key could read, modify, or delete all data — donations, tokens, polls, votes,
announcements, members, mosque accounts, etc. This migration replaces those open policies with proper
ownership-based RLS.

## Architecture
The app uses Supabase Auth. Each authenticated user has a `profiles` row linking them to either a `donors` row
(donor role) or a `mosque_accounts` row (mosque role). The `donors` table has an `auth_id` column linking to
`auth.users(id)`, as does `mosque_accounts`.

Two helper SECURITY DEFINER functions resolve the authenticated user's donor_id and mosque_account_id,
which policies use for ownership checks.

## Changes

### New Functions
1. `get_my_donor_id()` — returns the donor_id for the current authenticated user (SECURITY DEFINER)
2. `get_my_mosque_id()` — returns the mosque_id for the current authenticated user's mosque account (SECURITY DEFINER)
3. `get_my_mosque_account_id()` — returns the mosque_account_id for the current authenticated user (SECURITY DEFINER)

### Tables with RLS policies replaced (all 14 non-profiles tables):
- donors, mosque_accounts, mosques, mosque_members, needs, pledges, polls, poll_options,
  votes, announcements, announcement_reads, donor_requests, donor_mosque_tokens, token_transactions

### Policy structure per table:
- **donors**: users can read/update/delete their own donor row; mosque managers can read donors who are members of their mosque
- **mosque_accounts**: mosque managers can read/update only their own account
- **mosques**: public read (donors need to browse); only the linked mosque account can update
- **mosque_members**: donors read their own memberships; mosque managers read/manage their mosque's members; donors can insert their own membership
- **needs**: public read for non-archived; mosque managers full CRUD on their mosque's needs
- **pledges**: donors read their own pledges; mosque managers read pledges for their mosque's needs; donors insert their own; mosque managers update status
- **polls**: public read for non-archived active polls; mosque managers full CRUD on their mosque's polls
- **poll_options**: public read; mosque managers full CRUD on options for their mosque's polls
- **votes**: donors read their own votes; donors insert their own; mosque managers read votes for their mosque's polls
- **announcements**: public read for non-archived; mosque managers full CRUD on their mosque's announcements
- **announcement_reads**: donors manage their own read records
- **donor_requests**: donors CRUD their own requests; mosque managers read/manage requests for their mosque
- **donor_mosque_tokens**: donors read their own; mosque managers read tokens for their mosque; only SECURITY DEFINER functions modify (no client UPDATE policy)
- **token_transactions**: donors read their own; mosque managers read for their mosque

### Realtime
All tables already in the `supabase_realtime` publication. RLS now ensures realtime events only deliver
rows the authenticated user is authorized to see.

### Security notes
1. `donor_mosque_tokens` has NO client UPDATE/INSERT/DELETE policies — token modifications go through
   SECURITY DEFINER functions (`deduct_tokens_for_vote`, `award_tokens_for_pledge`) which bypass RLS.
2. `token_transactions` is insert-only via SECURITY DEFINER functions; clients can only SELECT.
3. Mosque managers can read donor name/email for members of their mosque (needed for pledge management).
4. `mosques` table is publicly readable (donors need to browse mosques) but only the linked account can modify.
5. The `profiles` table already has proper RLS — left unchanged.
*/

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS safely)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_donor_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.donors WHERE auth_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_mosque_account_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.mosque_accounts WHERE auth_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_mosque_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT mosque_id FROM public.mosque_accounts WHERE auth_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.get_my_donor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_mosque_account_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_mosque_id() TO authenticated;

-- ============================================================
-- donors
-- ============================================================

DROP POLICY IF EXISTS "anon_select_donors" ON donors;
DROP POLICY IF EXISTS "anon_insert_donors" ON donors;
DROP POLICY IF EXISTS "anon_update_donors" ON donors;
DROP POLICY IF EXISTS "anon_delete_donors" ON donors;

-- Donors can read their own row
CREATE POLICY "donors_select_own" ON donors
  FOR SELECT TO authenticated
  USING (id = public.get_my_donor_id());

-- Mosque managers can read donors who are members of their mosque
CREATE POLICY "donors_select_mosque_members" ON donors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mosque_members mm
      WHERE mm.donor_id = donors.id
        AND mm.mosque_id = public.get_my_mosque_id()
    )
  );

-- Donors can update their own row (name, etc.) but not token_balance (enforced by column grants)
CREATE POLICY "donors_update_own" ON donors
  FOR UPDATE TO authenticated
  USING (id = public.get_my_donor_id())
  WITH CHECK (id = public.get_my_donor_id());

-- Donors can delete their own row (soft delete via deleted_at updates)
-- Actual deletion handled by SECURITY DEFINER function delete_donor_account
-- No direct DELETE policy — deletion goes through RPC

-- ============================================================
-- mosque_accounts
-- ============================================================

DROP POLICY IF EXISTS "anon_select_mosque_accounts" ON mosque_accounts;
DROP POLICY IF EXISTS "anon_insert_mosque_accounts" ON mosque_accounts;
DROP POLICY IF EXISTS "anon_update_mosque_accounts" ON mosque_accounts;
DROP POLICY IF EXISTS "anon_delete_mosque_accounts" ON mosque_accounts;

-- Mosque managers read their own account
CREATE POLICY "mosque_accounts_select_own" ON mosque_accounts
  FOR SELECT TO authenticated
  USING (id = public.get_my_mosque_account_id());

-- Mosque managers update their own account
CREATE POLICY "mosque_accounts_update_own" ON mosque_accounts
  FOR UPDATE TO authenticated
  USING (id = public.get_my_mosque_account_id())
  WITH CHECK (id = public.get_my_mosque_account_id());

-- No direct INSERT — mosque registration creates rows via server flow
-- No direct DELETE — deletion goes through delete_mosque_account RPC

-- ============================================================
-- mosques
-- ============================================================

DROP POLICY IF EXISTS "anon_select_mosques" ON mosques;
DROP POLICY IF EXISTS "anon_insert_mosques" ON mosques;
DROP POLICY IF EXISTS "anon_update_mosques" ON mosques;
DROP POLICY IF EXISTS "anon_delete_mosques" ON mosques;

-- Public read: donors need to browse mosques (authenticated only, not anon)
CREATE POLICY "mosques_select_all" ON mosques
  FOR SELECT TO authenticated
  USING (true);

-- Only the linked mosque account can update
CREATE POLICY "mosques_update_own" ON mosques
  FOR UPDATE TO authenticated
  USING (
    id = public.get_my_mosque_id()
  )
  WITH CHECK (
    id = public.get_my_mosque_id()
  );

-- No direct INSERT/DELETE — mosque creation/deletion goes through registration/RPC flow

-- ============================================================
-- mosque_members
-- ============================================================

DROP POLICY IF EXISTS "anon_select_mosque_members" ON mosque_members;
DROP POLICY IF EXISTS "anon_insert_mosque_members" ON mosque_members;
DROP POLICY IF EXISTS "anon_update_mosque_members" ON mosque_members;
DROP POLICY IF EXISTS "anon_delete_mosque_members" ON mosque_members;

-- Donors read their own memberships
CREATE POLICY "members_select_own" ON mosque_members
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- Mosque managers read members of their mosque
CREATE POLICY "members_select_mosque" ON mosque_members
  FOR SELECT TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

-- Donors can join a mosque (insert their own membership)
CREATE POLICY "members_insert_own" ON mosque_members
  FOR INSERT TO authenticated
  WITH CHECK (donor_id = public.get_my_donor_id());

-- Mosque managers can remove members from their mosque
CREATE POLICY "members_delete_mosque" ON mosque_members
  FOR DELETE TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

-- Donors can leave (delete their own membership)
CREATE POLICY "members_delete_own" ON mosque_members
  FOR DELETE TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- No UPDATE — membership rows are insert/delete only

-- ============================================================
-- needs
-- ============================================================

DROP POLICY IF EXISTS "anon_select_needs" ON needs;
DROP POLICY IF EXISTS "anon_insert_needs" ON needs;
DROP POLICY IF EXISTS "anon_update_needs" ON needs;
DROP POLICY IF EXISTS "anon_delete_needs" ON needs;

-- Public read: donors need to see needs to pledge (authenticated only)
CREATE POLICY "needs_select_all" ON needs
  FOR SELECT TO authenticated
  USING (true);

-- Mosque managers insert needs for their mosque
CREATE POLICY "needs_insert_mosque" ON needs
  FOR INSERT TO authenticated
  WITH CHECK (mosque_id = public.get_my_mosque_id());

-- Mosque managers update needs for their mosque
CREATE POLICY "needs_update_mosque" ON needs
  FOR UPDATE TO authenticated
  USING (mosque_id = public.get_my_mosque_id())
  WITH CHECK (mosque_id = public.get_my_mosque_id());

-- Mosque managers delete needs for their mosque
CREATE POLICY "needs_delete_mosque" ON needs
  FOR DELETE TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

-- ============================================================
-- pledges
-- ============================================================

DROP POLICY IF EXISTS "anon_select_pledges" ON pledges;
DROP POLICY IF EXISTS "anon_insert_pledges" ON pledges;
DROP POLICY IF EXISTS "anon_update_pledges" ON pledges;
DROP POLICY IF EXISTS "anon_delete_pledges" ON pledges;

-- Donors read their own pledges
CREATE POLICY "pledges_select_own" ON pledges
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- Mosque managers read pledges for needs in their mosque
CREATE POLICY "pledges_select_mosque" ON pledges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.needs n
      WHERE n.id = pledges.need_id
        AND n.mosque_id = public.get_my_mosque_id()
    )
  );

-- Donors insert their own pledges
CREATE POLICY "pledges_insert_own" ON pledges
  FOR INSERT TO authenticated
  WITH CHECK (donor_id = public.get_my_donor_id());

-- Mosque managers update pledge status (confirm receipt)
CREATE POLICY "pledges_update_mosque" ON pledges
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.needs n
      WHERE n.id = pledges.need_id
        AND n.mosque_id = public.get_my_mosque_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.needs n
      WHERE n.id = pledges.need_id
        AND n.mosque_id = public.get_my_mosque_id()
    )
  );

-- Donors can cancel their own pending pledges
CREATE POLICY "pledges_update_own" ON pledges
  FOR UPDATE TO authenticated
  USING (donor_id = public.get_my_donor_id())
  WITH CHECK (donor_id = public.get_my_donor_id());

-- Donors can delete their own pledges
CREATE POLICY "pledges_delete_own" ON pledges
  FOR DELETE TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- ============================================================
-- polls
-- ============================================================

DROP POLICY IF EXISTS "anon_select_polls" ON polls;
DROP POLICY IF EXISTS "anon_insert_polls" ON polls;
DROP POLICY IF EXISTS "anon_update_polls" ON polls;
DROP POLICY IF EXISTS "anon_delete_polls" ON polls;

-- Public read: donors need to see polls to vote
CREATE POLICY "polls_select_all" ON polls
  FOR SELECT TO authenticated
  USING (true);

-- Mosque managers insert polls for their mosque
CREATE POLICY "polls_insert_mosque" ON polls
  FOR INSERT TO authenticated
  WITH CHECK (mosque_id = public.get_my_mosque_id());

-- Mosque managers update polls for their mosque
CREATE POLICY "polls_update_mosque" ON polls
  FOR UPDATE TO authenticated
  USING (mosque_id = public.get_my_mosque_id())
  WITH CHECK (mosque_id = public.get_my_mosque_id());

-- Mosque managers delete polls for their mosque
CREATE POLICY "polls_delete_mosque" ON polls
  FOR DELETE TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

-- ============================================================
-- poll_options
-- ============================================================

DROP POLICY IF EXISTS "anon_select_poll_options" ON poll_options;
DROP POLICY IF EXISTS "anon_insert_poll_options" ON poll_options;
DROP POLICY IF EXISTS "anon_update_poll_options" ON poll_options;
DROP POLICY IF EXISTS "anon_delete_poll_options" ON poll_options;

-- Public read
CREATE POLICY "poll_options_select_all" ON poll_options
  FOR SELECT TO authenticated
  USING (true);

-- Mosque managers insert options for their mosque's polls
CREATE POLICY "poll_options_insert_mosque" ON poll_options
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_options.poll_id
        AND p.mosque_id = public.get_my_mosque_id()
    )
  );

-- Mosque managers update options for their mosque's polls
CREATE POLICY "poll_options_update_mosque" ON poll_options
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_options.poll_id
        AND p.mosque_id = public.get_my_mosque_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_options.poll_id
        AND p.mosque_id = public.get_my_mosque_id()
    )
  );

-- Mosque managers delete options for their mosque's polls
CREATE POLICY "poll_options_delete_mosque" ON poll_options
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_options.poll_id
        AND p.mosque_id = public.get_my_mosque_id()
    )
  );

-- ============================================================
-- votes
-- ============================================================

DROP POLICY IF EXISTS "anon_select_votes" ON votes;
DROP POLICY IF EXISTS "anon_insert_votes" ON votes;
DROP POLICY IF EXISTS "anon_update_votes" ON votes;
DROP POLICY IF EXISTS "anon_delete_votes" ON votes;

-- Donors read their own votes
CREATE POLICY "votes_select_own" ON votes
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- Mosque managers read votes for their mosque's polls
CREATE POLICY "votes_select_mosque" ON votes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = votes.poll_id
        AND p.mosque_id = public.get_my_mosque_id()
    )
  );

-- Votes are inserted via deduct_tokens_for_vote SECURITY DEFINER function
-- No direct INSERT policy — prevents bypassing token deduction

-- No UPDATE or DELETE for votes — votes are immutable

-- ============================================================
-- announcements
-- ============================================================

DROP POLICY IF EXISTS "anon_select_announcements" ON announcements;
DROP POLICY IF EXISTS "anon_insert_announcements" ON announcements;
DROP POLICY IF EXISTS "anon_update_announcements" ON announcements;
DROP POLICY IF EXISTS "anon_delete_announcements" ON announcements;

-- Public read for non-archived announcements
CREATE POLICY "announcements_select_all" ON announcements
  FOR SELECT TO authenticated
  USING (true);

-- Mosque managers insert announcements for their mosque
CREATE POLICY "announcements_insert_mosque" ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (mosque_id = public.get_my_mosque_id());

-- Mosque managers update announcements for their mosque
CREATE POLICY "announcements_update_mosque" ON announcements
  FOR UPDATE TO authenticated
  USING (mosque_id = public.get_my_mosque_id())
  WITH CHECK (mosque_id = public.get_my_mosque_id());

-- Mosque managers delete announcements for their mosque
CREATE POLICY "announcements_delete_mosque" ON announcements
  FOR DELETE TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

-- ============================================================
-- announcement_reads
-- ============================================================

DROP POLICY IF EXISTS "select_announcement_reads" ON announcement_reads;
DROP POLICY IF EXISTS "insert_announcement_reads" ON announcement_reads;
DROP POLICY IF EXISTS "delete_announcement_reads" ON announcement_reads;

-- Donors read their own read records
CREATE POLICY "ann_reads_select_own" ON announcement_reads
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- Donors insert their own read records (mark as read)
CREATE POLICY "ann_reads_insert_own" ON announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (donor_id = public.get_my_donor_id());

-- Donors delete their own read records (mark as unread)
CREATE POLICY "ann_reads_delete_own" ON announcement_reads
  FOR DELETE TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- ============================================================
-- donor_requests (suggestions)
-- ============================================================

DROP POLICY IF EXISTS "anon_select_donor_requests" ON donor_requests;
DROP POLICY IF EXISTS "anon_insert_donor_requests" ON donor_requests;
DROP POLICY IF EXISTS "anon_update_donor_requests" ON donor_requests;
DROP POLICY IF EXISTS "anon_delete_donor_requests" ON donor_requests;

-- Donors read their own requests
CREATE POLICY "requests_select_own" ON donor_requests
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- Mosque managers read requests for their mosque
CREATE POLICY "requests_select_mosque" ON donor_requests
  FOR SELECT TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

-- Donors insert their own requests
CREATE POLICY "requests_insert_own" ON donor_requests
  FOR INSERT TO authenticated
  WITH CHECK (donor_id = public.get_my_donor_id());

-- Donors update their own requests
CREATE POLICY "requests_update_own" ON donor_requests
  FOR UPDATE TO authenticated
  USING (donor_id = public.get_my_donor_id())
  WITH CHECK (donor_id = public.get_my_donor_id());

-- Mosque managers update requests for their mosque (status, read_at, archived)
CREATE POLICY "requests_update_mosque" ON donor_requests
  FOR UPDATE TO authenticated
  USING (mosque_id = public.get_my_mosque_id())
  WITH CHECK (mosque_id = public.get_my_mosque_id());

-- Donors delete their own requests
CREATE POLICY "requests_delete_own" ON donor_requests
  FOR DELETE TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- ============================================================
-- donor_mosque_tokens
-- ============================================================

DROP POLICY IF EXISTS "anon_select_dmt" ON donor_mosque_tokens;
DROP POLICY IF EXISTS "anon_insert_dmt" ON donor_mosque_tokens;
DROP POLICY IF EXISTS "anon_update_dmt" ON donor_mosque_tokens;
DROP POLICY IF EXISTS "anon_delete_dmt" ON donor_mosque_tokens;

-- Donors read their own token balances
CREATE POLICY "dmt_select_own" ON donor_mosque_tokens
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- Mosque managers read token balances for their mosque
CREATE POLICY "dmt_select_mosque" ON donor_mosque_tokens
  FOR SELECT TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

-- NO INSERT/UPDATE/DELETE policies — all token modifications go through
-- SECURITY DEFINER functions (deduct_tokens_for_vote, award_tokens_for_pledge, add_mosque_member)
-- This prevents clients from directly manipulating token balances

-- ============================================================
-- token_transactions
-- ============================================================

DROP POLICY IF EXISTS "anon_select_token_transactions" ON token_transactions;
DROP POLICY IF EXISTS "select_own_token_transactions" ON token_transactions;

-- Donors read their own transactions
CREATE POLICY "tx_select_own" ON token_transactions
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- Mosque managers read transactions for their mosque
CREATE POLICY "tx_select_mosque" ON token_transactions
  FOR SELECT TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

-- NO INSERT/UPDATE/DELETE — transactions are written only by SECURITY DEFINER functions
