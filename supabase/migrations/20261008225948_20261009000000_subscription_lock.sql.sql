/*
# Server-Side Subscription Lock

## Purpose
When a mosque's subscription is inactive (is_paid = false), the database
must reject all management mutations: creating/editing/deleting needs,
announcements, polls, and donor requests. New member joins are also blocked.
Existing members are NOT removed — they retain read access and can still
pledge/donate. Only management actions are locked.

## Changes
1. New function: `is_mosque_subscribed(p_mosque_id uuid)` — SECURITY DEFINER
   helper that returns true if the mosque has an active subscription.
2. Modified policies on `needs`, `announcements`, `polls`:
   - INSERT, UPDATE, DELETE now require `is_mosque_subscribed(mosque_id)`
     in addition to ownership check.
   - SELECT policies remain unchanged (donors can still browse).
3. Modified policies on `donor_requests`:
   - Mosque-side UPDATE now requires subscription.
   - Donor-side INSERT/UPDATE/DELETE remain unchanged (donors can still submit).
4. Modified policies on `mosque_members`:
   - INSERT (new joins) now requires the mosque to be subscribed.
   - SELECT, DELETE remain unchanged.

## Important Notes
- This does NOT remove existing members or delete any data.
- Read access is fully preserved for all users.
- Donor-side actions (pledging, voting, submitting requests) are NOT locked.
- Only mosque management actions are blocked when subscription is inactive.
*/

-- ── Helper function ──
CREATE OR REPLACE FUNCTION is_mosque_subscribed(p_mosque_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_paid FROM mosque_accounts
     WHERE mosque_id = p_mosque_id AND deleted_at IS NULL
     LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION is_mosque_subscribed(uuid) TO authenticated;

-- ── Needs: lock management mutations ──
DROP POLICY IF EXISTS "needs_insert_mosque" ON needs;
CREATE POLICY "needs_insert_mosque" ON needs FOR INSERT
  TO authenticated WITH CHECK (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

DROP POLICY IF EXISTS "needs_update_mosque" ON needs;
CREATE POLICY "needs_update_mosque" ON needs FOR UPDATE
  TO authenticated USING (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  ) WITH CHECK (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

DROP POLICY IF EXISTS "needs_delete_mosque" ON needs;
CREATE POLICY "needs_delete_mosque" ON needs FOR DELETE
  TO authenticated USING (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

-- ── Announcements: lock management mutations ──
DROP POLICY IF EXISTS "announcements_insert_mosque" ON announcements;
CREATE POLICY "announcements_insert_mosque" ON announcements FOR INSERT
  TO authenticated WITH CHECK (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

DROP POLICY IF EXISTS "announcements_update_mosque" ON announcements;
CREATE POLICY "announcements_update_mosque" ON announcements FOR UPDATE
  TO authenticated USING (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  ) WITH CHECK (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

DROP POLICY IF EXISTS "announcements_delete_mosque" ON announcements;
CREATE POLICY "announcements_delete_mosque" ON announcements FOR DELETE
  TO authenticated USING (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

-- ── Polls: lock management mutations ──
DROP POLICY IF EXISTS "polls_insert_mosque" ON polls;
CREATE POLICY "polls_insert_mosque" ON polls FOR INSERT
  TO authenticated WITH CHECK (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

DROP POLICY IF EXISTS "polls_update_mosque" ON polls;
CREATE POLICY "polls_update_mosque" ON polls FOR UPDATE
  TO authenticated USING (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  ) WITH CHECK (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

DROP POLICY IF EXISTS "polls_delete_mosque" ON polls;
CREATE POLICY "polls_delete_mosque" ON polls FOR DELETE
  TO authenticated USING (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

-- ── Donor requests: lock mosque-side management (status changes) ──
DROP POLICY IF EXISTS "requests_update_mosque" ON donor_requests;
CREATE POLICY "requests_update_mosque" ON donor_requests FOR UPDATE
  TO authenticated USING (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  ) WITH CHECK (
    mosque_id = get_my_mosque_id() AND is_mosque_subscribed(mosque_id)
  );

-- ── Mosque members: block new joins when unpaid ──
DROP POLICY IF EXISTS "members_insert_own" ON mosque_members;
CREATE POLICY "members_insert_own" ON mosque_members FOR INSERT
  TO authenticated WITH CHECK (
    donor_id = get_my_donor_id() AND is_mosque_subscribed(mosque_id)
  );
