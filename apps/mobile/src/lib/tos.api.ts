import { api } from './api';

export type TosStatus = {
  current_version: string;
  published_at: string;
  accepted: boolean;
  accepted_version: string | null;
  accepted_at: string | null;
};

export async function getTosStatus(): Promise<TosStatus> {
  const res = await api.get<{ data: TosStatus }>('/auth/tos/current');
  return res.data;
}

export async function acceptTos(version: string): Promise<void> {
  await api.post('/auth/tos/accept', { version });
}
