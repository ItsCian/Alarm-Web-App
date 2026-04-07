import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TeamMember = {
  id: string;
  initials: string;
  name: string;
  role: string;
  avatarBg: string;
  avatarText: string;
};

type TeamMemberRow = {
  id: string;
  initials: string;
  name: string;
  role: string | null;
  avatar_bg?: string | null;
  avatar_text?: string | null;
  avatarbg?: string | null;
  avatartext?: string | null;
  avatarBg?: string | null;
  avatarText?: string | null;
};

function normalizeTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    initials: row.initials,
    name: row.name,
    role: row.role ?? "",
    avatarBg: row.avatar_bg ?? row.avatarBg ?? row.avatarbg ?? "bg-gray-100",
    avatarText:
      row.avatar_text ?? row.avatarText ?? row.avatartext ?? "text-gray-700",
  };
}

export type Project = {
  id: string;
  name: string;
  description: string;
  tags: string[];
};

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamMembers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("team_members")
        .select("*");

      if (fetchError) throw fetchError;
      setMembers(
        (data as TeamMemberRow[] | null)?.map(normalizeTeamMember) || [],
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch team members",
      );
      console.error("Error fetching team members:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  useEffect(() => {
    const channel = supabase
      .channel("team_members_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_members",
        },
        () => {
          fetchTeamMembers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTeamMembers]);

  return { members, loading, error };
}

export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (fetchError) throw fetchError;
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch project");
      console.error("Error fetching project:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    const channel = supabase
      .channel(`project_${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        () => {
          fetchProject();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchProject]);

  return { project, loading, error };
}

export type AlarmStatus = "armed" | "disarmed";
export type AlarmAction = "arm" | "disarm" | "test";

export type AlarmSystemState = {
  status: AlarmStatus;
  updatedAt: string;
  lastCommandId: string | null;
  lastError: string | null;
};

export type AlarmDeviceStatus = {
  isConnected: boolean;
  updatedAt: string;
  lastHeartbeatAt: string | null;
};

export type AlarmLog = {
  id: string;
  createdAt: string;
  level: "info" | "warning" | "error";
  eventType: string;
  message: string;
  metadata: Record<string, unknown>;
};

export type AlarmCommand = {
  id: string;
  createdAt: string;
  action: AlarmAction;
  requestedBy: string;
  status: "pending" | "rejected" | "sent" | "success" | "failed";
  errorMessage: string | null;
  processedAt: string | null;
};

type AlarmStateRow = {
  status: AlarmStatus;
  updated_at: string;
  last_command_id: string | null;
  last_error: string | null;
};

type AlarmDeviceRow = {
  is_connected: boolean;
  updated_at: string;
  last_heartbeat_at: string | null;
};

type AlarmLogRow = {
  id: string;
  created_at: string;
  level: "info" | "warning" | "error";
  event_type: string;
  message: string;
  metadata: Record<string, unknown> | null;
};

type AlarmActionResultRow = {
  ok: boolean;
  message: string;
  command_id: string | null;
};

type AlarmCommandRow = {
  id: string;
  created_at: string;
  action: AlarmAction;
  requested_by: string;
  status: "pending" | "rejected" | "sent" | "success" | "failed";
  error_message: string | null;
  processed_at: string | null;
};

type FakeProcessResultRow = {
  ok: boolean;
  message: string;
  command_id: string | null;
  action: AlarmAction | null;
  command_status: "pending" | "rejected" | "sent" | "success" | "failed";
};

function normalizeAlarmState(row: AlarmStateRow): AlarmSystemState {
  return {
    status: row.status,
    updatedAt: row.updated_at,
    lastCommandId: row.last_command_id,
    lastError: row.last_error,
  };
}

function normalizeAlarmDevice(row: AlarmDeviceRow): AlarmDeviceStatus {
  return {
    isConnected: row.is_connected,
    updatedAt: row.updated_at,
    lastHeartbeatAt: row.last_heartbeat_at,
  };
}

function normalizeAlarmLog(row: AlarmLogRow): AlarmLog {
  return {
    id: row.id,
    createdAt: row.created_at,
    level: row.level,
    eventType: row.event_type,
    message: row.message,
    metadata: row.metadata ?? {},
  };
}

function normalizeAlarmCommand(row: AlarmCommandRow): AlarmCommand {
  return {
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    requestedBy: row.requested_by,
    status: row.status,
    errorMessage: row.error_message,
    processedAt: row.processed_at,
  };
}

export function useAlarmSystem() {
  const [state, setState] = useState<AlarmSystemState | null>(null);
  const [device, setDevice] = useState<AlarmDeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlarmSystem = useCallback(async () => {
    try {
      setLoading(true);
      const [
        { data: stateData, error: stateError },
        { data: deviceData, error: deviceError },
      ] = await Promise.all([
        supabase
          .from("alarm_system_state")
          .select("status, updated_at, last_command_id, last_error")
          .eq("id", 1)
          .single(),
        supabase
          .from("alarm_device_status")
          .select("is_connected, updated_at, last_heartbeat_at")
          .eq("id", 1)
          .single(),
      ]);

      if (stateError) throw stateError;
      if (deviceError) throw deviceError;

      setState(normalizeAlarmState(stateData as AlarmStateRow));
      setDevice(normalizeAlarmDevice(deviceData as AlarmDeviceRow));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch realtime alarm state. Run supabase-init.sql first.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlarmSystem();
  }, [fetchAlarmSystem]);

  useEffect(() => {
    const channel = supabase
      .channel("alarm_system_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alarm_system_state",
        },
        () => {
          fetchAlarmSystem();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alarm_device_status",
        },
        () => {
          fetchAlarmSystem();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlarmSystem]);

  return { state, device, loading, error, refetch: fetchAlarmSystem };
}

export function useAlarmLogs(limit = 20) {
  const [logs, setLogs] = useState<AlarmLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("alarm_logs")
        .select("id, created_at, level, event_type, message, metadata")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setLogs((data as AlarmLogRow[] | null)?.map(normalizeAlarmLog) ?? []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch alarm logs",
      );
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const channel = supabase
      .channel("alarm_logs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alarm_logs",
        },
        () => {
          fetchLogs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}

export function useAlarmCommands(status?: AlarmCommand["status"]) {
  const [commands, setCommands] = useState<AlarmCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommands = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("alarm_commands")
        .select(
          "id, created_at, action, requested_by, status, error_message, processed_at",
        )
        .order("created_at", { ascending: false })
        .limit(30);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setCommands(
        (data as AlarmCommandRow[] | null)?.map(normalizeAlarmCommand) ?? [],
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch alarm commands",
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchCommands();
  }, [fetchCommands]);

  useEffect(() => {
    const channel = supabase
      .channel(`alarm_commands_changes_${status ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alarm_commands",
        },
        () => {
          fetchCommands();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCommands, status]);

  return { commands, loading, error, refetch: fetchCommands };
}

export async function requestAlarmAction(
  action: AlarmAction,
  requestedBy = "web-ui",
) {
  const { data, error } = await supabase.rpc("request_alarm_action", {
    p_action: action,
    p_requested_by: requestedBy,
  });

  if (error) {
    throw new Error(error.message);
  }

  const resultRow = (
    Array.isArray(data) ? data[0] : data
  ) as AlarmActionResultRow | null;

  if (!resultRow) {
    return {
      ok: false,
      message: "No response from request_alarm_action",
      commandId: null,
    };
  }

  return {
    ok: resultRow.ok,
    message: resultRow.message,
    commandId: resultRow.command_id,
  };
}

export async function updateAlarmDeviceConnection(isConnected: boolean) {
  const { error } = await supabase.rpc("update_alarm_device_status", {
    p_is_connected: isConnected,
    p_last_heartbeat_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fakeAlarmProcessNextCommand() {
  const { data, error } = await supabase.rpc("fake_alarm_process_next_command");

  if (error) {
    throw new Error(error.message);
  }

  const resultRow = (
    Array.isArray(data) ? data[0] : data
  ) as FakeProcessResultRow | null;

  if (!resultRow) {
    return {
      ok: false,
      message: "No response from fake_alarm_process_next_command",
      commandId: null,
      action: null,
      commandStatus: "failed" as const,
    };
  }

  return {
    ok: resultRow.ok,
    message: resultRow.message,
    commandId: resultRow.command_id,
    action: resultRow.action,
    commandStatus: resultRow.command_status,
  };
}
