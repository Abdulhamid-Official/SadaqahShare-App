/*
# Fix function search_path security warnings

Recreates existing SECURITY DEFINER functions with SET search_path = public
to prevent search path injection attacks.
*/

-- drop the two functions that changed return type
DROP FUNCTION IF EXISTS public.delete_donor_account(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.delete_mosque_account(uuid) CASCADE;

-- delete_donor_account (now returns void)
CREATE FUNCTION public.delete_donor_account(p_donor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE donors SET deleted_at = now() WHERE id = p_donor_id;
  DELETE FROM mosque_members WHERE donor_id = p_donor_id;
  DELETE FROM donor_mosque_tokens WHERE donor_id = p_donor_id;
  DELETE FROM announcement_reads WHERE donor_id = p_donor_id;
  DELETE FROM notifications WHERE donor_id = p_donor_id;
  DELETE FROM push_tokens WHERE donor_id = p_donor_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_donor_account(uuid) TO authenticated;

-- delete_mosque_account
CREATE FUNCTION public.delete_mosque_account(p_mosque_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mosque_id uuid;
BEGIN
  SELECT mosque_id INTO v_mosque_id FROM mosque_accounts WHERE id = p_mosque_account_id;
  UPDATE mosque_accounts SET deleted_at = now() WHERE id = p_mosque_account_id;
  DELETE FROM mosque_members WHERE mosque_id = v_mosque_id;
  DELETE FROM announcements WHERE mosque_id = v_mosque_id;
  DELETE FROM polls WHERE mosque_id = v_mosque_id;
  DELETE FROM needs WHERE mosque_id = v_mosque_id;
  DELETE FROM donor_mosque_tokens WHERE mosque_id = v_mosque_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_mosque_account(uuid) TO authenticated;

-- Recreate the other functions with SET search_path
-- award_tokens_for_pledge
CREATE OR REPLACE FUNCTION public.award_tokens_for_pledge(p_pledge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
SELECT * INTO v_pledge FROM pledges WHERE id = p_pledge_id FOR UPDATE;
IF NOT FOUND THEN
  RETURN jsonb_build_object('success', false, 'error', 'Pledge not found');
END IF;
IF v_pledge.status = 'fulfilled' THEN
  RETURN jsonb_build_object('success', true, 'message', 'Already confirmed', 'tokens_awarded', 0);
END IF;
SELECT mosque_id INTO v_mosque_id FROM needs WHERE id = v_pledge.need_id;
v_donor_id := v_pledge.donor_id;
v_quantity := v_pledge.quantity;
v_tokens := v_pledge.tokens_earned;
IF v_tokens = 0 THEN
  SELECT tokens_per_unit INTO v_tokens FROM needs WHERE id = v_pledge.need_id;
  v_tokens := v_tokens * v_quantity;
END IF;
IF v_tokens <= 0 THEN
  UPDATE pledges SET status = 'fulfilled', confirmed_at = now() WHERE id = p_pledge_id;
  RETURN jsonb_build_object('success', true, 'tokens_awarded', 0);
END IF;
SELECT * INTO v_token_row FROM donor_mosque_tokens WHERE donor_id = v_donor_id AND mosque_id = v_mosque_id FOR UPDATE;
IF NOT FOUND THEN
  INSERT INTO donor_mosque_tokens (donor_id, mosque_id, token_balance) VALUES (v_donor_id, v_mosque_id, 0) RETURNING * INTO v_token_row;
END IF;
v_current_balance := v_token_row.token_balance;
UPDATE donor_mosque_tokens SET token_balance = token_balance + v_tokens WHERE donor_id = v_donor_id AND mosque_id = v_mosque_id;
INSERT INTO token_transactions (donor_id, mosque_id, amount, balance_after, type, reference_id, description)
VALUES (v_donor_id, v_mosque_id, v_tokens, v_current_balance + v_tokens, 'donation_confirmed', p_pledge_id, 'Tokens awarded for confirmed donation');
UPDATE pledges SET status = 'fulfilled', confirmed_at = now() WHERE id = p_pledge_id;
RETURN jsonb_build_object('success', true, 'tokens_awarded', v_tokens, 'new_balance', v_current_balance + v_tokens);
END;
$$;

-- deduct_tokens_for_vote
CREATE OR REPLACE FUNCTION public.deduct_tokens_for_vote(
  p_donor_id uuid, p_mosque_id uuid, p_poll_id uuid, p_option_id uuid, p_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_balance int;
v_poll RECORD;
v_vote_count int;
v_token_row RECORD;
BEGIN
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
SELECT count(*) INTO v_vote_count FROM votes WHERE donor_id = p_donor_id AND poll_id = p_poll_id;
IF v_vote_count >= v_poll.max_votes_per_person THEN
  RETURN jsonb_build_object('success', false, 'error', 'Maximum votes reached for this poll');
END IF;
SELECT * INTO v_token_row FROM donor_mosque_tokens WHERE donor_id = p_donor_id AND mosque_id = p_mosque_id FOR UPDATE;
IF NOT FOUND THEN
  RETURN jsonb_build_object('success', false, 'error', 'No token balance at this mosque');
END IF;
v_balance := v_token_row.token_balance;
IF v_balance < p_amount THEN
  RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens');
END IF;
UPDATE donor_mosque_tokens SET token_balance = token_balance - p_amount WHERE donor_id = p_donor_id AND mosque_id = p_mosque_id;
INSERT INTO votes (donor_id, poll_id, option_id, tokens_spent) VALUES (p_donor_id, p_poll_id, p_option_id, p_amount);
INSERT INTO token_transactions (donor_id, mosque_id, amount, balance_after, type, reference_id, description)
VALUES (p_donor_id, p_mosque_id, -p_amount, v_balance - p_amount, 'vote', p_poll_id, 'Tokens spent on poll vote');
RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$;

-- add_mosque_member
CREATE OR REPLACE FUNCTION public.add_mosque_member(p_donor_id uuid, p_mosque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_max_members int;
v_current_count int;
v_is_paid boolean;
BEGIN
SELECT max_members, is_paid INTO v_max_members, v_is_paid FROM mosque_accounts WHERE mosque_id = p_mosque_id AND deleted_at IS NULL;
IF NOT FOUND THEN
  RETURN jsonb_build_object('success', false, 'error', 'Mosque account not found');
END IF;
IF NOT v_is_paid THEN
  RETURN jsonb_build_object('success', false, 'error', 'Mosque subscription is inactive');
END IF;
SELECT count(*) INTO v_current_count FROM mosque_members WHERE mosque_id = p_mosque_id;
IF v_current_count >= v_max_members THEN
  RETURN jsonb_build_object('success', false, 'error', 'Member capacity reached');
END IF;
INSERT INTO mosque_members (donor_id, mosque_id) VALUES (p_donor_id, p_mosque_id)
  ON CONFLICT DO NOTHING;
INSERT INTO donor_mosque_tokens (donor_id, mosque_id, token_balance)
  VALUES (p_donor_id, p_mosque_id, 0)
  ON CONFLICT DO NOTHING;
RETURN jsonb_build_object('success', true);
END;
$$;

-- Trigger functions
CREATE OR REPLACE FUNCTION public.update_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_needs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
