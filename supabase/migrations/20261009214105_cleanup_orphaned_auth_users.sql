/*
# Clean Up Orphaned Auth Users

## Problem
13 auth.users were created during failed registration attempts (before the RLS INSERT
policies were added). These users have auth accounts but no profile, no donor record,
and no mosque_account — meaning registration appeared to fail, but Supabase Auth
actually created the account. When users try to register again with the same email,
Supabase returns "User already registered" even though the app never finished setup.

## Solution
Delete the orphaned auth.users so those emails can be re-used for registration.
Only deletes users with NO profile, NO donor, and NO mosque_account — users with
any linked data are preserved.
*/

DO $$
DECLARE
  orphaned RECORD;
BEGIN
  FOR orphaned IN
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.donors d ON d.auth_id = u.id
    LEFT JOIN public.mosque_accounts ma ON ma.auth_id = u.id
    WHERE p.id IS NULL AND d.id IS NULL AND ma.id IS NULL
  LOOP
    RAISE NOTICE 'Deleting orphaned auth user: % (%)', orphaned.email, orphaned.id;
    DELETE FROM auth.users WHERE id = orphaned.id;
  END LOOP;
END $$;
