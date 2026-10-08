/*
# Server-Side Security Functions: Token Operations, Member Management, Account Deletion, Token Validation

## Overview
This migration creates SECURITY DEFINER functions that enforce business-critical
security rules at the database level. These functions are the ONLY way to perform
token changes, member additions, and account deletion — client-side manipulation
is blocked by RLS.

## New Functions

### award_tokens_for_pledge(pledge_uuid)
- Called when a mosque confirms a pledge/donation receipt
- Awards tokens to the donor's mosque-scoped balance
- Records an audit entry in token_transactions
- Updates pledge status to 'fulfilled' with confirmed_at timestamp
- Idempotent — re-confirming a fulfilled pledge is a no-op

### deduct_tokens_for_vote(p_donor_uuid, p_mosque_uuid, p_poll_uuid, p_option_uuid, p_amount)
- Called when a donor votes in a poll
- Checks sufficient balance, deducts tokens atomically
- Records the vote and audit entry
- Prevents duplicate votes beyond max_votes_per_person

### add_mosque_member(p_donor_id, p_mosque_id)
- Enforces member cap from mosque_accounts.max_members
- Checks subscription is active (is_paid = true)
- Atomically inserts the membership row
- Returns error if cap reached or subscription inactive

### delete_donor_account(p_donor_id)
- Soft-deletes the donor: sets deleted_at, anonymizes name/email
- Removes mosque memberships (but preserves pledge/vote history)
- Anonymizes donor_name and donor_email on historical pledges
- Disables auth by removing the profile
- Returns success/error

### delete_mosque_account(p_mosque_account_id)
- Soft-deletes the mosque account: sets deleted_at
- Anonymizes email on mosque_accounts
- Removes the profile (disables auth login)
- Preserves mosque data, needs, pledges, etc. for historical/audit purposes
- Returns success/error

### validate_token_reasonableness(p_name, p_description, p_quantity, p_tokens_per_unit, p_category)
- Deterministic server-side validation for need token values
- Returns { valid: boolean, reason: text }
- Checks: token value per unit within reasonable bounds for category
- Checks: total tokens (qty × per_unit) within max bounds
- Flags obviously abusive values

## Security
- All functions are SECURITY DEFINER — they run with database owner privileges
- EXECUTE granted to authenticated and anon (app needs to call them)
- Token functions are the only way to modify donor_mosque_tokens balances
- Member cap cannot be bypassed because the function checks server-side
- Account deletion anonymizes historical records without destroying them

## Important Notes
1. award_tokens_for_pledge is idempotent — safe to call multiple times
2. deduct_tokens_for_vote uses FOR UPDATE lock to prevent race conditions
3. add_mosque_member counts current members server-side, not from the client
4. delete_donor_account preserves financial/token records but anonymizes PII
5. validate_token_reasonableness uses deterministic rules (not AI) as the foundation
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- Function 1: award_tokens_for_pledge
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION award_tokens_for_pledge(p_pledge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pledge RECORD;
  v_mosque_id uuid;
  v_donor_id uuid;
  v_tokens int;
  v_current_balance int;
  v_token_row RECORD;
  v_quantity int;
BEGIN
  -- Lock the pledge row
  SELECT * INTO v_pledge FROM pledges WHERE id = p_pledge_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pledge not found');
  END IF;

  -- Idempotency: already fulfilled
  IF v_pledge.status = 'fulfilled' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already confirmed', 'tokens_awarded', 0);
  END IF;

  v_mosque_id := v_pledge.need_id IS NOT NULL;
  -- Get mosque_id from the need
  SELECT mosque_id INTO v_mosque_id FROM needs WHERE id = v_pledge.need_id;
  v_donor_id := v_pledge.donor_id;
  v_quantity := v_pledge.quantity;
  v_tokens := v_pledge.tokens_earned;

  -- If tokens_earned is 0 but we have tokens_per_unit on the need, compute it
  IF v_tokens = 0 THEN
    SELECT tokens_per_unit INTO v_tokens FROM needs WHERE id = v_pledge.need_id;
    v_tokens := v_tokens * v_quantity;
  END IF;

  IF v_tokens <= 0 THEN
    -- Update pledge status without awarding tokens
    UPDATE pledges SET status = 'fulfilled', confirmed_at = now() WHERE id = p_pledge_id;
    RETURN jsonb_build_object('success', true, 'tokens_awarded', 0);
  END IF;

  -- Get or create donor_mosque_tokens row with lock
  SELECT * INTO v_token_row
    FROM donor_mosque_tokens
    WHERE donor_id = v_donor_id AND mosque_id = v_mosque_id
    FOR UPDATE;

  IF NOT FOUND THEN
    -- Create token row
    INSERT INTO donor_mosque_tokens (donor_id, mosque_id, token_balance)
    VALUES (v_donor_id, v_mosque_id, 0)
    RETURNING * INTO v_token_row;
  END IF;

  v_current_balance := v_token_row.token_balance;

  -- Award tokens
  UPDATE donor_mosque_tokens
    SET token_balance = token_balance + v_tokens
    WHERE donor_id = v_donor_id AND mosque_id = v_mosque_id;

  -- Record audit entry
  INSERT INTO token_transactions (donor_id, mosque_id, amount, balance_after, type, reference_id, description)
  VALUES (v_donor_id, v_mosque_id, v_tokens, v_current_balance + v_tokens, 'donation_confirmed', p_pledge_id,
    'Tokens awarded for confirmed donation');

  -- Update pledge
  UPDATE pledges SET status = 'fulfilled', confirmed_at = now() WHERE id = p_pledge_id;

  RETURN jsonb_build_object('success', true, 'tokens_awarded', v_tokens, 'new_balance', v_current_balance + v_tokens);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function 2: deduct_tokens_for_vote
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION deduct_tokens_for_vote(
  p_donor_id uuid,
  p_mosque_id uuid,
  p_poll_id uuid,
  p_option_id uuid,
  p_amount int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance int;
  v_poll RECORD;
  v_vote_count int;
  v_token_row RECORD;
BEGIN
  -- Validate poll exists and is active
  SELECT * INTO v_poll FROM polls WHERE id = p_poll_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poll not found');
  END IF;

  IF v_poll.archived = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poll is archived');
  END IF;

  IF v_poll.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poll is not active');
  END IF;

  -- Check vote count against max
  SELECT count(*) INTO v_vote_count FROM votes WHERE donor_id = p_donor_id AND poll_id = p_poll_id;
  IF v_vote_count >= v_poll.max_votes_per_person THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum votes reached for this poll');
  END IF;

  -- Check sufficient tokens with row lock
  SELECT * INTO v_token_row
    FROM donor_mosque_tokens
    WHERE donor_id = p_donor_id AND mosque_id = p_mosque_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No token balance at this mosque');
  END IF;

  v_balance := v_token_row.token_balance;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens');
  END IF;

  -- Deduct tokens
  UPDATE donor_mosque_tokens
    SET token_balance = token_balance - p_amount
    WHERE donor_id = p_donor_id AND mosque_id = p_mosque_id;

  -- Insert vote
  INSERT INTO votes (donor_id, poll_id, option_id, tokens_spent)
  VALUES (p_donor_id, p_poll_id, p_option_id, p_amount);

  -- Audit entry
  INSERT INTO token_transactions (donor_id, mosque_id, amount, balance_after, type, reference_id, description)
  VALUES (p_donor_id, p_mosque_id, -p_amount, v_balance - p_amount, 'vote', p_poll_id,
    'Tokens spent on poll vote');

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function 3: add_mosque_member
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_mosque_member(p_donor_id uuid, p_mosque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account RECORD;
  v_current_count int;
  v_existing RECORD;
BEGIN
  -- Check if already a member
  SELECT * INTO v_existing FROM mosque_members
    WHERE donor_id = p_donor_id AND mosque_id = p_mosque_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already a member');
  END IF;

  -- Get mosque account for cap + subscription check
  SELECT * INTO v_account FROM mosque_accounts WHERE mosque_id = p_mosque_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mosque account not found');
  END IF;

  -- Check subscription is active
  IF v_account.is_paid = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mosque subscription is inactive. New members cannot be added until the subscription is active.');
  END IF;

  -- Count current members
  SELECT count(*) INTO v_current_count FROM mosque_members WHERE mosque_id = p_mosque_id;

  -- Check capacity
  IF v_current_count >= v_account.max_members THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mosque has reached its member capacity. Upgrade your plan to add more members.', 'current_count', v_current_count, 'max_members', v_account.max_members);
  END IF;

  -- Insert membership
  INSERT INTO mosque_members (donor_id, mosque_id)
  VALUES (p_donor_id, p_mosque_id);

  RETURN jsonb_build_object('success', true, 'message', 'Member added');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function 4: delete_donor_account
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_donor_account(p_donor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_donor RECORD;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_donor FROM donors WHERE id = p_donor_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Donor not found');
  END IF;

  -- Anonymize donor record (soft delete)
  UPDATE donors
    SET deleted_at = now(),
        name = 'Deleted User',
        email = 'deleted_' || p_donor_id::text || '@removed.local',
        name_anonymized = true
    WHERE id = p_donor_id;

  -- Anonymize historical pledges (preserve financial records)
  UPDATE pledges
    SET donor_name = 'Deleted User',
        donor_email = 'deleted_' || p_dledge_id::text || '@removed.local'
    WHERE donor_id = p_donor_id;

  -- Remove memberships (not financial records)
  DELETE FROM mosque_members WHERE donor_id = p_donor_id;

  -- Remove donor requests (suggestions are user content, not financial)
  DELETE FROM donor_requests WHERE donor_id = p_donor_id;

  -- Remove announcement reads
  DELETE FROM announcement_reads WHERE donor_id = p_donor_id;

  -- Remove the profile (disables auth login)
  DELETE FROM profiles WHERE donor_id = p_donor_id;

  RETURN jsonb_build_object('success', true, 'message', 'Account deleted. Historical records preserved and anonymized.');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function 5: delete_mosque_account
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_mosque_account(p_mosque_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account RECORD;
BEGIN
  SELECT * INTO v_account FROM mosque_accounts WHERE id = p_mosque_account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mosque account not found');
  END IF;

  -- Soft-delete the account
  UPDATE mosque_accounts
    SET deleted_at = now(),
        email = 'deleted_' || p_mosque_account_id::text || '@removed.local',
        is_paid = false
    WHERE id = p_mosque_account_id;

  -- Remove the profile (disables auth login)
  DELETE FROM profiles WHERE mosque_account_id = p_mosque_account_id;

  -- Preserve mosque data, needs, pledges, polls, announcements for audit
  -- but archive everything
  UPDATE needs SET archived = true, archived_at = now() WHERE mosque_id = v_account.mosque_id AND archived = false;
  UPDATE polls SET archived = true, archived_at = now() WHERE mosque_id = v_account.mosque_id AND archived = false;
  UPDATE announcements SET archived = true, archived_at = now() WHERE mosque_id = v_account.mosque_id AND archived = false;

  -- Remove members (they can no longer interact with a deleted mosque)
  DELETE FROM mosque_members WHERE mosque_id = v_account.mosque_id;

  RETURN jsonb_build_object('success', true, 'message', 'Mosque account deleted. Historical records archived and preserved.');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function 6: validate_token_reasonableness
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_token_reasonableness(
  p_name text,
  p_description text,
  p_quantity int,
  p_tokens_per_unit int,
  p_category text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_tokens int;
  v_max_per_unit int := 100;
  v_max_total int := 5000;
  v_min_per_unit int := 1;
BEGIN
  v_total_tokens := p_quantity * p_tokens_per_unit;

  -- Basic bounds checks
  IF p_tokens_per_unit < v_min_per_unit THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Tokens per unit must be at least 1');
  END IF;

  IF p_tokens_per_unit > v_max_per_unit THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Tokens per unit (' || p_tokens_per_unit || ') exceeds the maximum of ' || v_max_per_unit || '. This seems unreasonably high for a single item.');
  END IF;

  IF v_total_tokens > v_max_total THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Total token value (' || v_total_tokens || ') exceeds the maximum of ' || v_max_total || '. Please review the quantity and token amount.');
  END IF;

  -- Category-specific reasonableness
  -- Low-value categories should have lower token caps per unit
  IF p_category IN ('Supplies', 'Food') AND p_tokens_per_unit > 50 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'For ' || p_category || ' items, tokens per unit should not exceed 50. A typical item in this category does not warrant ' || p_tokens_per_unit || ' tokens.');
  END IF;

  IF p_category = 'Clothing' AND p_tokens_per_unit > 40 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'For Clothing items, tokens per unit should not exceed 40.');
  END IF;

  -- High-value categories get more room
  IF p_category IN ('Appliances', 'Medical', 'Furnishings') AND p_tokens_per_unit > 80 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'For ' || p_category || ' items, tokens per unit should not exceed 80.');
  END IF;

  -- Check for suspicious patterns: high tokens with very high quantity
  IF p_quantity > 100 AND p_tokens_per_unit > 20 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'High quantity (' || p_quantity || ') combined with high token value (' || p_tokens_per_unit || ' per unit) seems unreasonable. Total would be ' || v_total_tokens || ' tokens.');
  END IF;

  RETURN jsonb_build_object('valid', true, 'reason', 'Token value is within reasonable bounds');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Grant EXECUTE on all functions to authenticated and anon
-- ═══════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION award_tokens_for_pledge(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION deduct_tokens_for_vote(uuid, uuid, uuid, uuid, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_mosque_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION delete_donor_account(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION delete_mosque_account(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_token_reasonableness(text, text, int, int, text) TO authenticated, anon;