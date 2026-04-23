import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createReminder,
  deleteReminder,
  listReminders,
  updateReminder,
  type CreateReminderInput,
  type UpdateReminderInput,
} from '../lib/reminders.api';

const KEY = ['reminders'] as const;

export const useReminders = () => useQuery({ queryKey: KEY, queryFn: listReminders });

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReminderInput) => createReminder(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReminderInput }) =>
      updateReminder(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
