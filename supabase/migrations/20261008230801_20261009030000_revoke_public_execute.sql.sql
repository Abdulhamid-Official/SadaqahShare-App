/*
# Revoke PUBLIC Execute on SECURITY DEFINER Functions

## Purpose
PostgreSQL grants EXECUTE to PUBLIC by default on new functions.
The anon role inherits from PUBLIC, so REVOKE FROM anon alone
doesn't work. We must REVOKE FROM PUBLIC to close the gap.

## Changes
- REVOKE EXECUTE ON ALL SECURITY DEFINER functions FROM PUBLIC
- Re-grant EXECUTE TO authenticated (already done, but idempotent)

## Notes
- This ensures unauthenticated users cannot call any SECURITY DEFINER function
- Trigger functions (notify_*, update_*) are called internally by triggers,
  not through the REST API, so this doesn't affect their operation
*/

REVOKE EXECUTE ON FUNCTION get_my_donor_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_my_mosque_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_my_mosque_account_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_mosque_subscribed(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION add_mosque_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION award_tokens_for_pledge(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION deduct_tokens_for_vote(uuid, uuid, uuid, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_notification(uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION delete_donor_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION delete_mosque_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_announcement_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_pledge_confirmed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_poll_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_suggestion_updated() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_needs_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_profile_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_token_reasonableness(text, text, integer, integer, text) FROM PUBLIC;
