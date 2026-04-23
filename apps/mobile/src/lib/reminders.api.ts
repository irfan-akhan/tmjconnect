import { api } from './api';

export type ReminderType = 'exercise' | 'symptom';
export type ReminderDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type Reminder = {
  id: string;
  user_id: string;
  type: ReminderType;
  /** HH:MM:SS format from server; we normalize to HH:MM in UI. */
  time: string;
  days: ReminderDay[];
  enabled: boolean;
  next_fire_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateReminderInput = {
  type: ReminderType;
  /** HH:MM format; API accepts HH:MM and coerces to seconds server-side. */
  time: string;
  days: ReminderDay[];
  enabled?: boolean;
};

export type UpdateReminderInput = Partial<CreateReminderInput>;

export async function listReminders(): Promise<Reminder[]> {
  const res = await api.get<{ data: Reminder[] }>('/reminders');
  return res.data;
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const res = await api.post<{ data: Reminder }>('/reminders', input);
  return res.data;
}

export async function updateReminder(id: string, input: UpdateReminderInput): Promise<Reminder> {
  const res = await api.patch<{ data: Reminder }>(`/reminders/${id}`, input);
  return res.data;
}

export async function deleteReminder(id: string): Promise<void> {
  await api.delete(`/reminders/${id}`);
}
