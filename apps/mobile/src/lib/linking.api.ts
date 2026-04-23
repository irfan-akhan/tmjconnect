import { api } from './api';
import type { PatientLink } from './patient.api';

export async function acceptLinkingCode(code: string): Promise<PatientLink> {
  const res = await api.post<{ data: PatientLink }>('/linking/accept', {
    code: code.toUpperCase(),
  });
  return res.data;
}

export async function disconnectLink(linkId: string): Promise<void> {
  await api.delete(`/linking/links/${linkId}`);
}
