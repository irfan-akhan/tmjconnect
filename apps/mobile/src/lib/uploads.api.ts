import { ApiError, BASE_URL } from './api';
import { getAccessToken } from './tokens';

export type UploadResult = {
  url: string;
  key?: string;
  size?: number;
  mime_type?: string;
};

export type UploadFile = {
  uri: string;
  name: string;
  type: string;
};

async function postMultipart<T>(path: string, file: UploadFile): Promise<T> {
  const access = await getAccessToken();
  const form = new FormData();
  form.append('file', file as unknown as Blob);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: access ? { Authorization: `Bearer ${access}` } : {},
    body: form,
  });

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const payload: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const p = (payload ?? {}) as { error?: { code?: string; message?: string } };
    throw new ApiError(res.status, p.error?.message ?? res.statusText, p.error?.code);
  }
  return payload as T;
}

export async function uploadAvatar(file: UploadFile): Promise<UploadResult> {
  const res = await postMultipart<{ data: UploadResult }>('/uploads/avatar', file);
  return res.data;
}
