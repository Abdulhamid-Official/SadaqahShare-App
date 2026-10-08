/*
# Fix Security Advisor Findings

## Purpose
1. Fix mutable search_path on `validate_token_reasonableness` function
2. Revoke EXECUTE from `anon` role on all SECURITY DEFINER functions
   so unauthenticated users cannot call them via the REST API.

## Changes
- Recreate `validate_token_reasonableness` with `SET search_path = public`
- REVOKE EXECUTE on all SECURITY DEFINER functions from `anon` role
- GRANT EXECUTE on key functions to `authenticated` role

## Important Notes
- Helper functions (get_my_*) are only useful to authenticated users
- Trigger functions (notify_*, update_*) are called by table triggers, not REST
- Action functions (add_mosque_member, award_tokens, etc.) require auth
*/

-- Fix search_path on validate_token_reasonableness
DROP FUNCTION IF EXISTS validate_token_reasonableness(text, text, integer);
DROP FUNCTION IF EXISTS validate_token_reasonableness(text, text, integer, integer, text);

CREATE OR REPLACE FUNCTION validate_token_reasonableness(
  p_name text,
  p_description text,
  p_quantity integer,
  p_tokens_per_unit integer,
  p_category text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(trim(p_name)) < 2 OR length(trim(p_name)) > 200 THEN
    RETURN false;
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 2000 THEN
    RETURN false;
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 10000 THEN
    RETURN false;
  END IF;
  IF p_tokens_per_unit IS NULL OR p_tokens_per_unit < 1 OR p_tokens_per_unit > 1000 THEN
    RETURN false;
  END IF;
  IF p_category IS NOT NULL AND length(p_category) > 100 THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

-- Revoke EXECUTE from anon on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION get_my_donor_id() FROM anon;
REVOKE EXECUTE ON FUNCTION get_my_mosque_id() FROM anon;
REVOKE EXECUTE ON FUNCTION get_my_mosque_account_id() FROM anon;
REVOKE EXECUTE ON FUNCTION is_mosque_subscribed(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION add_mosque_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION award_tokens_for_pledge(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION deduct_tokens_for_vote(uuid, uuid, uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION create_notification(uuid, uuid, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION delete_donor_account(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION delete_mosque_account(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION notify_announcement_created() FROM anon;
REVOKE EXECUTE ON FUNCTION notify_pledge_confirmed() FROM anon;
REVOKE EXECUTE ON FUNCTION notify_poll_created() FROM anon;
REVOKE EXECUTE ON FUNCTION notify_suggestion_updated() FROM anon;
REVOKE EXECUTE ON FUNCTION update_needs_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION update_profile_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION validate_token_reasonableness(text, text, integer, integer, text) FROM anon;

-- Ensure authenticated role has EXECUTE on user-facing functions
GRANT EXECUTE ON FUNCTION get_my_donor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_mosque_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_mosque_account_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_mosque_subscribed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_mosque_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION award_tokens_for_pledge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_tokens_for_vote(uuid, uuid, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_donor_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_mosque_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_token_reasonableness(text, text, integer, integer, text) TO authenticated;
