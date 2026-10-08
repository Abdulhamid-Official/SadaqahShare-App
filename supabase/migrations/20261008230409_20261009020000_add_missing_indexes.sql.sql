/*
# Add Missing Foreign Key Indexes

## Purpose
Add indexes on foreign key columns that are missing covering indexes,
improving query performance for joins and filters.

## Changes
- notifications.mosque_id: add index
- profiles.donor_id: add index
- profiles.mosque_account_id: add index
- votes.donor_id: add index (if votes table exists)

## Notes
- These are CREATE INDEX IF NOT EXISTS, safe to re-run
- Improves join performance and filter queries
*/

CREATE INDEX IF NOT EXISTS idx_notifications_mosque_id ON notifications(mosque_id);
CREATE INDEX IF NOT EXISTS idx_profiles_donor_id ON profiles(donor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mosque_account_id ON profiles(mosque_account_id);
CREATE INDEX IF NOT EXISTS idx_votes_donor_id ON votes(donor_id);
