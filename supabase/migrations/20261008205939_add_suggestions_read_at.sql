/*
# Suggestions System: Add read_at for tracking read state

## Overview
Adds `read_at` timestamp to donor_requests for tracking when a mosque manager
explicitly marks a suggestion as read. Also migrates old 'reviewed' status.

## Modified Tables

### donor_requests
- `read_at` (timestamptz, nullable) — NULL = unread. Set when mosque manager
  explicitly marks suggestion as read. Opening a suggestion does NOT set this.

## Notes
1. Existing 'reviewed' rows migrated to 'active' with read_at = updated_at
2. Indexes added for read_at and status query performance
*/

-- Add read_at column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donor_requests' AND column_name = 'read_at') THEN
    ALTER TABLE donor_requests ADD COLUMN read_at timestamptz;
  END IF;
END $$;

-- Migrate old 'reviewed' status to 'active' and set read_at
UPDATE donor_requests SET read_at = updated_at, status = 'active' WHERE status = 'reviewed' AND read_at IS NULL;

-- Add index for unread query performance
CREATE INDEX IF NOT EXISTS idx_donor_requests_read_at ON donor_requests(read_at);
CREATE INDEX IF NOT EXISTS idx_donor_requests_status ON donor_requests(status);