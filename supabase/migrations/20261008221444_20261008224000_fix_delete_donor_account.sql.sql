/*
# Fix: delete_donor_account anonymize pledges query

Fixes a typo in the delete_donor_account function where `p_dledge_id`
was referenced instead of using the donor_id for the anonymization.
*/

CREATE OR REPLACE FUNCTION delete_donor_account(p_donor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_donor RECORD;
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
        donor_email = 'deleted_' || p_donor_id::text || '@removed.local'
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

GRANT EXECUTE ON FUNCTION delete_donor_account(uuid) TO authenticated, anon;