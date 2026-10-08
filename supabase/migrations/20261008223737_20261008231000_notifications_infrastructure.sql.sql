/*
# Notifications Infrastructure — Parts 24, 25, 26

## Purpose
Creates the notifications table and push token storage for in-app notification center,
push notifications, and unread indicators.

## New Tables

### notifications
- id (uuid PK)
- donor_id (uuid FK to donors) — recipient
- mosque_id (uuid FK to mosques) — which mosque the notification relates to
- type (text) — notification type: 'donation_confirmed', 'donation_received', 'announcement', 'poll_created', 'token_awarded', 'suggestion_updated', 'member_joined', 'subscription', 'security'
- title (text) — notification title
- body (text) — notification body
- data (jsonb) — additional data (e.g., pledge_id, poll_id, announcement_id)
- read_at (timestamptz, nullable) — when the donor marked it read (null = unread)
- created_at (timestamptz)

### push_tokens
- id (uuid PK)
- donor_id (uuid FK to donors) — which donor this token belongs to
- token (text) — Expo push token
- platform (text) — 'ios', 'android', 'web'
- created_at (timestamptz)
- last_used_at (timestamptz)

### push_tokens_unique
Unique constraint on (donor_id, token) to prevent duplicate push tokens.

## RLS
- notifications: donors can read/update their own; mosque managers read for their mosque; SECURITY DEFINER functions insert
- push_tokens: donors can manage their own tokens

## Indexes
- notifications(donor_id, created_at DESC) — for notification center list
- notifications(donor_id, read_at) — for unread count
- push_tokens(donor_id) — for looking up tokens by donor
*/

-- ============================================================
-- notifications table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES public.donors(id) ON DELETE CASCADE,
  mosque_id uuid REFERENCES public.mosques(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_donor_created ON public.notifications (donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_donor_unread ON public.notifications (donor_id) WHERE read_at IS NULL;

-- Policies
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

DROP POLICY IF EXISTS "notif_select_mosque" ON notifications;
CREATE POLICY "notif_select_mosque" ON notifications
  FOR SELECT TO authenticated
  USING (mosque_id = public.get_my_mosque_id());

DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (donor_id = public.get_my_donor_id())
  WITH CHECK (donor_id = public.get_my_donor_id());

-- No direct INSERT/DELETE policy for clients — notifications are created by triggers/functions
-- Donors can mark-as-read (UPDATE) but not delete; clearing = setting read_at

-- ============================================================
-- push_tokens table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES public.donors(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Unique constraint to prevent duplicate tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_donor_token ON public.push_tokens (donor_id, token);

-- Index for looking up tokens by donor
CREATE INDEX IF NOT EXISTS idx_push_tokens_donor ON public.push_tokens (donor_id);

-- Policies
DROP POLICY IF EXISTS "push_tokens_select_own" ON push_tokens;
CREATE POLICY "push_tokens_select_own" ON push_tokens
  FOR SELECT TO authenticated
  USING (donor_id = public.get_my_donor_id());

DROP POLICY IF EXISTS "push_tokens_insert_own" ON push_tokens;
CREATE POLICY "push_tokens_insert_own" ON push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (donor_id = public.get_my_donor_id());

DROP POLICY IF EXISTS "push_tokens_delete_own" ON push_tokens;
CREATE POLICY "push_tokens_delete_own" ON push_tokens
  FOR DELETE TO authenticated
  USING (donor_id = public.get_my_donor_id());

-- No UPDATE — tokens are insert/delete only

-- ============================================================
-- Add notifications to realtime publication
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- Helper function to create a notification
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_donor_id uuid,
  p_mosque_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (donor_id, mosque_id, type, title, body, data)
  VALUES (p_donor_id, p_mosque_id, p_type, p_title, p_body, p_data);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, jsonb) TO authenticated;

-- ============================================================
-- Trigger: notify donor when pledge is confirmed
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_pledge_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mosque_id uuid;
  v_mosque_name text;
BEGIN
  -- Only fire when status changes to 'fulfilled'
  IF NEW.status = 'fulfilled' AND (OLD.status IS NULL OR OLD.status != 'fulfilled') THEN
    SELECT mosque_id INTO v_mosque_id FROM public.needs WHERE id = NEW.need_id;
    SELECT name INTO v_mosque_name FROM public.mosques WHERE id = v_mosque_id;

    PERFORM public.create_notification(
      NEW.donor_id,
      v_mosque_id,
      'donation_confirmed',
      'Donation Confirmed!',
      'Your donation of ' || NEW.quantity || ' item(s) has been confirmed by ' || COALESCE(v_mosque_name, 'the mosque') || '. You earned ' || NEW.tokens_earned || ' tokens.',
      jsonb_build_object('pledge_id', NEW.id, 'tokens_earned', NEW.tokens_earned)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pledge_confirmed ON public.pledges;
CREATE TRIGGER trg_pledge_confirmed
  AFTER UPDATE ON public.pledges
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pledge_confirmed();

-- ============================================================
-- Trigger: notify mosque managers when a new pledge arrives
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_pledge_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mosque_id uuid;
  v_mosque_account_id uuid;
  v_donor_id uuid;
BEGIN
  SELECT mosque_id INTO v_mosque_id FROM public.needs WHERE id = NEW.need_id;
  SELECT id INTO v_mosque_account_id FROM public.mosque_accounts WHERE mosque_id = v_mosque_id AND deleted_at IS NULL;

  -- We need the mosque manager's donor_id... but mosque managers don't have donor_id
  -- They have auth_id. We need to find their profile and then... 
  -- Actually notifications are donor-scoped. Mosque managers aren't donors.
  -- For mosque-side notifications, we'll use a different approach: notify via the mosque dashboard
  -- and realtime. Push notifications for mosque managers would need a separate path.
  -- For now, skip mosque-manager push notifications — they get realtime updates on the dashboard.
  RETURN NEW;
END;
$$;

-- We won't create this trigger since mosque managers aren't donors and notifications are donor-scoped.
-- Mosque managers get realtime updates through the pledges tab instead.

DROP FUNCTION IF EXISTS public.notify_pledge_received() CASCADE;

-- ============================================================
-- Trigger: notify donors when a new announcement is posted
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_announcement_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
  v_mosque_name text;
BEGIN
  -- Only fire on INSERT and non-archived announcements
  IF NEW.archived = false THEN
    SELECT name INTO v_mosque_name FROM public.mosques WHERE id = NEW.mosque_id;

    -- Notify all members of this mosque
    FOR member_record IN
      SELECT donor_id FROM public.mosque_members WHERE mosque_id = NEW.mosque_id
    LOOP
      PERFORM public.create_notification(
        member_record.donor_id,
        NEW.mosque_id,
        'announcement',
        'New Announcement from ' || COALESCE(v_mosque_name, 'Your Mosque'),
        LEFT(COALESCE(NEW.body, NEW.title), 100),
        jsonb_build_object('announcement_id', NEW.id, 'mosque_id', NEW.mosque_id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcement_created ON public.announcements;
CREATE TRIGGER trg_announcement_created
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_announcement_created();

-- ============================================================
-- Trigger: notify donors when a new poll is created
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_poll_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
  v_mosque_name text;
BEGIN
  -- Only fire on INSERT and non-archived active polls
  IF NEW.archived = false AND NEW.status = 'active' THEN
    SELECT name INTO v_mosque_name FROM public.mosques WHERE id = NEW.mosque_id;

    FOR member_record IN
      SELECT donor_id FROM public.mosque_members WHERE mosque_id = NEW.mosque_id
    LOOP
      PERFORM public.create_notification(
        member_record.donor_id,
        NEW.mosque_id,
        'poll_created',
        'New Poll: ' || LEFT(NEW.question, 60),
        COALESCE(v_mosque_name, 'Your mosque') || ' has a new poll. Use your tokens to vote!',
        jsonb_build_object('poll_id', NEW.id, 'mosque_id', NEW.mosque_id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_poll_created ON public.polls;
CREATE TRIGGER trg_poll_created
  AFTER INSERT ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_poll_created();

-- ============================================================
-- Trigger: notify donor when their suggestion status changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_suggestion_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mosque_name text;
  v_status_label text;
BEGIN
  -- Only fire when status changes
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.donor_id IS NOT NULL THEN
    SELECT name INTO v_mosque_name FROM public.mosques WHERE id = NEW.mosque_id;

    v_status_label := CASE NEW.status
      WHEN 'accepted' THEN 'accepted'
      WHEN 'declined' THEN 'declined'
      ELSE 'updated'
    END;

    PERFORM public.create_notification(
      NEW.donor_id,
      NEW.mosque_id,
      'suggestion_updated',
      'Suggestion ' || v_status_label,
      'Your suggestion "' || LEFT(NEW.title, 50) || '" has been ' || v_status_label || ' by ' || COALESCE(v_mosque_name, 'the mosque'),
      jsonb_build_object('request_id', NEW.id, 'mosque_id', NEW.mosque_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suggestion_updated ON public.donor_requests;
CREATE TRIGGER trg_suggestion_updated
  AFTER UPDATE ON public.donor_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_suggestion_updated();
