/*
# Fix Registration: Add Missing INSERT Policies

## Problem
Mosque and donor registration failed with "new row violates row-level security policy"
because the `mosques`, `donors`, and `mosque_accounts` tables had SELECT and UPDATE
policies but NO INSERT policies. Authenticated users could not create new rows.

## Changes
1. `mosques` — Add INSERT policy allowing any authenticated user to create a mosque row.
   This is safe because registration creates the auth user first, then inserts the mosque.
2. `donors` — Add INSERT policy allowing authenticated users to create their own donor
   profile (linked via `auth_id`).
3. `mosque_accounts` — Add INSERT policy allowing authenticated users to create their own
   mosque account (linked via `auth_id`).

## Security
- All INSERT policies scope to `TO authenticated` (requires a valid session).
- `donors` and `mosque_accounts` inserts are constrained to rows where `auth_id = auth.uid()`.
- `mosques` insert is allowed for any authenticated user (the mosque row itself has no
  owner column; ownership is established via the `mosque_accounts` table which links
  `auth_id` to the mosque).
*/

-- mosques: allow authenticated users to insert (create new mosque during registration)
DROP POLICY IF EXISTS "mosques_insert_authenticated" ON mosques;
CREATE POLICY "mosques_insert_authenticated"
ON mosques FOR INSERT
TO authenticated
WITH CHECK (true);

-- donors: allow authenticated users to insert their own donor profile
DROP POLICY IF EXISTS "donors_insert_own" ON donors;
CREATE POLICY "donors_insert_own"
ON donors FOR INSERT
TO authenticated
WITH CHECK (auth_id = auth.uid());

-- mosque_accounts: allow authenticated users to insert their own mosque account
DROP POLICY IF EXISTS "mosque_accounts_insert_own" ON mosque_accounts;
CREATE POLICY "mosque_accounts_insert_own"
ON mosque_accounts FOR INSERT
TO authenticated
WITH CHECK (auth_id = auth.uid());

-- Also add DELETE policy for mosque_accounts so the registration rollback
-- (deleting mosque if account insert fails) can work
DROP POLICY IF EXISTS "mosque_accounts_delete_own" ON mosque_accounts;
CREATE POLICY "mosque_accounts_delete_own"
ON mosque_accounts FOR DELETE
TO authenticated
USING (auth_id = auth.uid());

-- Add DELETE for mosques so registration rollback can delete the mosque if account creation fails
DROP POLICY IF EXISTS "mosques_delete_own" ON mosques;
CREATE POLICY "mosques_delete_own"
ON mosques FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM mosque_accounts
  WHERE mosque_accounts.mosque_id = mosques.id
  AND mosque_accounts.auth_id = auth.uid()
));