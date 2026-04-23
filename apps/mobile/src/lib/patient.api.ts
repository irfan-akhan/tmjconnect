/**
 * Typed wrappers for patient-facing `/patients/*`, `/symptoms/*`,
 * `/exercises/*`, `/notifications/*`, and `/linking/*` endpoints.
 *
 * Every response from this API wraps the payload in `{ data: ... }` — these
 * wrappers unwrap that so callers get the inner value directly. Shapes
 * verified against live API on 2026-04-16.
 */

import { api } from './api';

// ─── /patients/me ──────────────────────────────────────────────────────────
export type PatientProfile = {
  id: string;
  email: string;
  phone: string | null;
  role: 'patient';
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  fcm_token: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
};

export async function getPatientMe(): Promise<PatientProfile> {
  const res = await api.get<{ data: PatientProfile }>('/patients/me');
  return res.data;
}

// ─── /patients/dashboard (consolidated) ───────────────────────────────────
export type DashboardData = {
  profile: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
  today_log: {
    id: string;
    pain_level: number;
    pain_types: string[];
    logged_at: string;
  } | null;
  streak: { streak: number; longest: number };
  assignments: {
    assignment_id: string;
    title: string;
    category: string;
    duration_seconds: number;
    frequency: string;
    sets: number;
    status: string;
    completed_today: boolean;
  }[];
  notifications: {
    id: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    created_at: string;
  }[];
  unread_count: number;
};

export async function getPatientDashboard(): Promise<DashboardData> {
  const res = await api.get<{ data: DashboardData }>('/patients/dashboard');
  return res.data;
}

export type UpdatePatientProfileInput = {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
  timezone?: string;
  avatar_url?: string | null;
};

export async function updatePatientMe(input: UpdatePatientProfileInput): Promise<PatientProfile> {
  const res = await api.patch<{ data: PatientProfile }>('/patients/me', input);
  return res.data;
}

export async function deletePatientMe(): Promise<void> {
  await api.delete('/patients/me');
}

// ─── Sessions ─────────────────────────────────────────────────────────────
export type PatientSession = {
  id: string;
  device_info: string | null;
  ip_address: string | null;
  last_active: string;
  created_at: string;
};

export async function getPatientSessions(): Promise<PatientSession[]> {
  const res = await api.get<{ data: PatientSession[] }>('/patients/me/sessions');
  return res.data;
}

export async function revokePatientSession(sessionId: string): Promise<void> {
  await api.delete(`/patients/me/sessions/${sessionId}`);
}

// ─── Activity ─────────────────────────────────────────────────────────────
export type PatientActivity = {
  id: string;
  action: string;
  resource_type: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export async function getPatientActivity(): Promise<PatientActivity[]> {
  const res = await api.get<{ data: PatientActivity[] }>('/patients/me/activity');
  return res.data;
}

// ─── Notification preferences ─────────────────────────────────────────────
export type NotificationPrefs = {
  exercise_reminders: boolean;
  symptom_checkin: boolean;
  provider_messages: boolean;
  report_updates: boolean;
  tips_updates: boolean;
  email_digest: 'instant' | 'daily' | 'weekly' | 'never';
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const res = await api.get<{ data: NotificationPrefs }>('/patients/me/notification-preferences');
  return res.data;
}

export async function updateNotificationPrefs(
  input: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const res = await api.patch<{ data: NotificationPrefs }>('/patients/me/notification-preferences', input);
  return res.data;
}

// ─── /symptoms ─────────────────────────────────────────────────────────────
export type BodyArea = { area: string; side?: 'left' | 'right' | 'both' | 'center' };

export type SymptomLog = {
  id: string;
  patient_id: string;
  pain_level: number;
  pain_types: string[];
  body_areas: BodyArea[];
  duration_minutes: number | null;
  triggers: string[];
  notes: string;
  logged_at: string;
  created_at: string;
  updated_at: string;
};

export type SymptomLogInput = {
  pain_level: number;
  pain_types?: string[];
  body_areas?: BodyArea[];
  duration_minutes?: number | null;
  triggers?: string[];
  notes?: string | null;
  logged_at?: string;
};

export type SymptomLogUpdate = Partial<SymptomLogInput>;

export type SymptomStats = {
  first_logged_at: string | null;
  total_count: number;
};

export type SymptomCalendarDay = { day: string; avg_pain: number; count: number };

export async function getSymptomStats(): Promise<SymptomStats> {
  const res = await api.get<{ data: SymptomStats }>('/symptoms/stats');
  return res.data;
}

export async function getRecentSymptoms(limit = 7): Promise<SymptomLog[]> {
  const res = await api.get<{ data: SymptomLog[] }>('/symptoms', { query: { limit } });
  return res.data;
}

export async function getSymptomCalendar(year: number, month: number): Promise<SymptomCalendarDay[]> {
  const res = await api.get<{ data: SymptomCalendarDay[] }>('/symptoms/calendar', {
    query: { year, month },
  });
  return res.data;
}

export async function getSymptomLog(id: string): Promise<SymptomLog> {
  const res = await api.get<{ data: SymptomLog }>(`/symptoms/${id}`);
  return res.data;
}

export async function upsertSymptomLog(input: SymptomLogInput): Promise<SymptomLog> {
  const res = await api.post<{ data: SymptomLog }>('/symptoms', input);
  return res.data;
}

export async function updateSymptomLog(id: string, input: SymptomLogUpdate): Promise<SymptomLog> {
  const res = await api.patch<{ data: SymptomLog }>(`/symptoms/${id}`, input);
  return res.data;
}

// ─── /exercises/assignments ───────────────────────────────────────────────
export type ExerciseAssignment = {
  assignment_id: string;
  exercise_id: string;
  title: string;
  description: string;
  duration_seconds: number;
  category: string;
  instructions: string;
  video_url: string | null;
  thumbnail_url: string | null;
  frequency: 'daily' | 'weekly' | string;
  sets: number;
  status: 'active' | 'completed' | 'paused' | string;
  assigned_at: string;
  provider_id: string;
  provider_first_name: string;
  provider_last_name: string;
  /** True if the patient marked this assignment complete today. */
  completed_today: boolean;
};

export async function getExerciseAssignments(): Promise<ExerciseAssignment[]> {
  const res = await api.get<{ data: ExerciseAssignment[] }>('/exercises/assignments');
  return res.data;
}

// ─── /notifications ───────────────────────────────────────────────────────
export type NotificationItem = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
};

export async function getNotifications(limit = 20): Promise<NotificationItem[]> {
  const res = await api.get<{ data: NotificationItem[] }>('/notifications', { query: { limit } });
  return res.data;
}

// ─── /linking/links ───────────────────────────────────────────────────────
export type PatientLink = {
  link_id: string;
  provider_id: string;
  first_name: string;
  last_name: string;
  linked_at: string;
};

export async function getPatientLinks(): Promise<PatientLink[]> {
  const res = await api.get<{ data: PatientLink[] }>('/linking/links');
  return res.data;
}
