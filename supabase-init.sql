-- ============================================================================
-- SUPABASE DATABASE INITIALIZATION SCRIPT
-- Re-run safe script for project metadata + alarm realtime backend
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  initials VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  "avatarBg" VARCHAR(50),
  "avatarText" VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tags TEXT[]
);

CREATE TABLE IF NOT EXISTS public.alarm_system_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('armed', 'disarmed')) DEFAULT 'disarmed',
  last_command_id UUID,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS public.alarm_device_status (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.alarm_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action TEXT NOT NULL CHECK (action IN ('arm', 'disarm', 'test')),
  requested_by TEXT NOT NULL DEFAULT 'web',
  status TEXT NOT NULL CHECK (status IN ('pending', 'rejected', 'sent', 'success', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.alarm_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarm_system_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarm_device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarm_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarm_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Enable read for all users on team_members" ON public.team_members;
CREATE POLICY "Enable read for all users on team_members"
  ON public.team_members
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable read for all users on projects" ON public.projects;
CREATE POLICY "Enable read for all users on projects"
  ON public.projects
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable read for all users on alarm_system_state" ON public.alarm_system_state;
CREATE POLICY "Enable read for all users on alarm_system_state"
  ON public.alarm_system_state
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable read for all users on alarm_device_status" ON public.alarm_device_status;
CREATE POLICY "Enable read for all users on alarm_device_status"
  ON public.alarm_device_status
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable read for all users on alarm_commands" ON public.alarm_commands;
CREATE POLICY "Enable read for all users on alarm_commands"
  ON public.alarm_commands
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable insert for all users on alarm_commands" ON public.alarm_commands;
CREATE POLICY "Enable insert for all users on alarm_commands"
  ON public.alarm_commands
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read for all users on alarm_logs" ON public.alarm_logs;
CREATE POLICY "Enable read for all users on alarm_logs"
  ON public.alarm_logs
  FOR SELECT
  USING (true);

-- ============================================================================
-- 4. CREATE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_alarm_action(
  p_action TEXT,
  p_requested_by TEXT DEFAULT 'web'
)
RETURNS TABLE(ok BOOLEAN, message TEXT, command_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connected BOOLEAN := FALSE;
  v_last_heartbeat_at TIMESTAMP WITH TIME ZONE;
  v_is_stale BOOLEAN := FALSE;
  v_command_id UUID;
  v_message TEXT;
BEGIN
  IF p_action NOT IN ('arm', 'disarm', 'test') THEN
    RAISE EXCEPTION 'Unsupported alarm action: %', p_action;
  END IF;

  SELECT is_connected, last_heartbeat_at
    INTO v_connected, v_last_heartbeat_at
  FROM public.alarm_device_status
  WHERE id = 1;

  v_is_stale := (
    v_last_heartbeat_at IS NULL
    OR EXTRACT(EPOCH FROM (NOW() - v_last_heartbeat_at)) > 70
  );

  IF v_is_stale THEN
    IF COALESCE(v_connected, FALSE) = TRUE THEN
      UPDATE public.alarm_device_status
      SET is_connected = FALSE,
          updated_at = NOW()
      WHERE id = 1;

      INSERT INTO public.alarm_logs (level, event_type, message, metadata)
      VALUES (
        'warning',
        'device_offline_timeout',
        'Physical alarm marked offline: heartbeat timeout',
        jsonb_build_object(
          'last_heartbeat_at', v_last_heartbeat_at,
          'timeout_seconds', 70
        )
      );
    END IF;

    v_connected := FALSE;
  END IF;

  IF COALESCE(v_connected, FALSE) = FALSE THEN
    v_message := CASE
      WHEN p_action = 'arm' THEN 'Cannot arm alarm: realtime connection to physical alarm is offline.'
      WHEN p_action = 'disarm' THEN 'Cannot disarm alarm: realtime connection to physical alarm is offline.'
      ELSE 'Cannot test alarm: realtime connection to physical alarm is offline.'
    END;

    INSERT INTO public.alarm_commands (action, requested_by, status, error_message)
    VALUES (p_action, p_requested_by, 'rejected', v_message)
    RETURNING id INTO v_command_id;

    UPDATE public.alarm_system_state
    SET updated_at = NOW(),
        last_command_id = v_command_id,
        last_error = v_message
    WHERE id = 1;

    INSERT INTO public.alarm_logs (level, event_type, message, metadata)
    VALUES (
      'error',
      format('%s_rejected_offline', p_action),
      v_message,
      jsonb_build_object('requested_by', p_requested_by, 'command_id', v_command_id)
    );

    RETURN QUERY SELECT FALSE, v_message, v_command_id;
    RETURN;
  END IF;

  INSERT INTO public.alarm_commands (action, requested_by, status)
  VALUES (p_action, p_requested_by, 'pending')
  RETURNING id INTO v_command_id;

  UPDATE public.alarm_system_state
  SET updated_at = NOW(),
      last_command_id = v_command_id,
      last_error = NULL
  WHERE id = 1;

  INSERT INTO public.alarm_logs (level, event_type, message, metadata)
  VALUES (
    'info',
    'command_requested',
    format('Alarm action requested: %s', p_action),
    jsonb_build_object('action', p_action, 'requested_by', p_requested_by, 'command_id', v_command_id)
  );

  RETURN QUERY SELECT TRUE, 'Command queued for device', v_command_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_alarm_action(TEXT, TEXT) TO anon, authenticated;

-- Helper for the future Raspberry Pi process to update connectivity heartbeat.
CREATE OR REPLACE FUNCTION public.update_alarm_device_status(
  p_is_connected BOOLEAN,
  p_last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.alarm_device_status
  SET is_connected = p_is_connected,
      last_heartbeat_at = p_last_heartbeat_at,
      updated_at = NOW()
  WHERE id = 1;

  INSERT INTO public.alarm_logs (level, event_type, message, metadata)
  VALUES (
    CASE WHEN p_is_connected THEN 'info' ELSE 'warning' END,
    CASE WHEN p_is_connected THEN 'device_online' ELSE 'device_offline' END,
    CASE WHEN p_is_connected THEN 'Physical alarm connection restored' ELSE 'Physical alarm connection lost' END,
    jsonb_build_object('last_heartbeat_at', p_last_heartbeat_at)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_alarm_device_status(BOOLEAN, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;

-- Pico helper: acknowledge command execution and write normalized logs.
CREATE OR REPLACE FUNCTION public.report_alarm_command_result(
  p_command_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_command public.alarm_commands%ROWTYPE;
  v_next_state TEXT;
BEGIN
  IF p_status NOT IN ('sent', 'success', 'failed') THEN
    RAISE EXCEPTION 'Unsupported command status: %', p_status;
  END IF;

  SELECT *
    INTO v_command
  FROM public.alarm_commands
  WHERE id = p_command_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Command not found';
    RETURN;
  END IF;

  UPDATE public.alarm_commands
  SET status = p_status,
      error_message = CASE WHEN p_status = 'failed' THEN COALESCE(p_error_message, 'Command failed on device') ELSE NULL END,
      processed_at = NOW()
  WHERE id = p_command_id;

  IF p_status = 'success' THEN
    v_next_state := CASE
      WHEN v_command.action = 'arm' THEN 'armed'
      WHEN v_command.action = 'disarm' THEN 'disarmed'
      ELSE (SELECT status FROM public.alarm_system_state WHERE id = 1)
    END;

    UPDATE public.alarm_system_state
    SET status = COALESCE(v_next_state, status),
        updated_at = NOW(),
        last_command_id = p_command_id,
        last_error = NULL
    WHERE id = 1;

    INSERT INTO public.alarm_logs (level, event_type, message, metadata)
    VALUES (
      'info',
      CASE
        WHEN v_command.action = 'arm' THEN 'alarm_armed'
        WHEN v_command.action = 'disarm' THEN 'alarm_disarmed'
        ELSE 'alarm_test_ok'
      END,
      CASE
        WHEN v_command.action = 'arm' THEN 'Alarm set on by device'
        WHEN v_command.action = 'disarm' THEN 'Alarm disarmed by device'
        ELSE 'Alarm test executed by device'
      END,
      jsonb_build_object(
        'command_id', p_command_id,
        'action', v_command.action,
        'requested_by', v_command.requested_by,
        'reported_status', p_status
      )
    );
  ELSIF p_status = 'failed' THEN
    UPDATE public.alarm_system_state
    SET updated_at = NOW(),
        last_command_id = p_command_id,
        last_error = COALESCE(p_error_message, 'Device command failed')
    WHERE id = 1;

    INSERT INTO public.alarm_logs (level, event_type, message, metadata)
    VALUES (
      'error',
      'command_failed_device',
      format('Device failed to execute %s command', v_command.action),
      jsonb_build_object(
        'command_id', p_command_id,
        'action', v_command.action,
        'requested_by', v_command.requested_by,
        'error_message', COALESCE(p_error_message, 'Device command failed')
      )
    );
  ELSE
    INSERT INTO public.alarm_logs (level, event_type, message, metadata)
    VALUES (
      'info',
      'command_sent_device',
      format('Device acknowledged %s command as sent', v_command.action),
      jsonb_build_object(
        'command_id', p_command_id,
        'action', v_command.action,
        'requested_by', v_command.requested_by
      )
    );
  END IF;

  RETURN QUERY SELECT TRUE, 'Command result stored';
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_alarm_command_result(UUID, TEXT, TEXT) TO anon, authenticated;

-- Pico helper: write a log entry when a sensor/intrusion triggers the alarm.
CREATE OR REPLACE FUNCTION public.report_alarm_trigger(
  p_trigger_source TEXT DEFAULT 'sensor',
  p_message TEXT DEFAULT 'Alarm triggered',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.alarm_system_state
  SET updated_at = NOW(),
      last_error = NULL
  WHERE id = 1;

  INSERT INTO public.alarm_logs (level, event_type, message, metadata)
  VALUES (
    'warning',
    'alarm_triggered',
    p_message,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('trigger_source', p_trigger_source)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_alarm_trigger(TEXT, TEXT, JSONB) TO anon, authenticated;

-- ============================================================================
-- 5. SEED BASE DATA
-- ============================================================================

INSERT INTO public.team_members (initials, name, role, "avatarBg", "avatarText")
SELECT x.initials, x.name, x.role, x.avatar_bg, x.avatar_text
FROM (
  VALUES
    ('JA', 'Justin Aerts', '', 'bg-emerald-100', 'text-emerald-800'),
    ('EH', 'Emilien Henskens', '', 'bg-violet-100', 'text-violet-800'),
    ('GM', 'Gaspard Munguia Coca', '', 'bg-orange-100', 'text-orange-800'),
    ('DP', 'Daniel Pinto Guimaraes Amaral', '', 'bg-orange-100', 'text-orange-800'),
    ('CJ', 'Cian Jones', '', 'bg-sky-100', 'text-sky-800')
) AS x(initials, name, role, avatar_bg, avatar_text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm WHERE tm.initials = x.initials
);

INSERT INTO public.projects (name, description, tags)
SELECT
  'Alarm Remote System',
  'A Raspberry Pi based alarm system with a custom PCB, controllable via this web interface. The hardware handles sensing and actuation; this frontend provides a clean remote for arming, disarming, and monitoring status in real time.',
  ARRAY['Raspberry Pi', 'Custom PCB', 'Next.js + shadcn/ui', 'Supabase Realtime']
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects WHERE name = 'Alarm Remote System'
);

INSERT INTO public.alarm_system_state (id, status)
VALUES (1, 'disarmed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.alarm_device_status (id, is_connected, last_heartbeat_at)
VALUES (1, FALSE, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.alarm_logs (level, event_type, message)
SELECT 'info', 'system_bootstrap', 'Alarm backend schema initialized'
WHERE NOT EXISTS (
  SELECT 1 FROM public.alarm_logs WHERE event_type = 'system_bootstrap'
);

-- ============================================================================
-- 6. ENABLE REPLICATION FOR REALTIME
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alarm_system_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alarm_system_state;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alarm_device_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alarm_device_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alarm_commands'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alarm_commands;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alarm_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alarm_logs;
  END IF;
END;
$$;

-- ============================================================================
-- DONE
-- ============================================================================
-- Ready for:
-- - Realtime alarm state monitoring in web app
-- - Arm/disarm/test command queue
-- - Error log when arm is attempted while device is offline
-- - Future Raspberry Pi process to consume pending commands and report heartbeat
-- ============================================================================
