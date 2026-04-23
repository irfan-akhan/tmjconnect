import { api } from './api';

export async function changePassword(current: string, next: string): Promise<void> {
  await api.patch('/auth/change-password', {
    current_password: current,
    new_password: next,
  });
}
