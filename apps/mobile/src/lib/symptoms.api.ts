import { api } from './api';

export async function deleteSymptomLog(id: string): Promise<void> {
  await api.delete(`/symptoms/${id}`);
}
