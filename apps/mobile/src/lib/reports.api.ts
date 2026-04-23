import { api } from './api';

export type ReportUrgency = 'routine' | 'concerning' | 'urgent';
export type ReportStatus = 'submitted' | 'viewed' | 'reviewed' | 'responded';

export type ReportSummary = {
  id: string;
  provider_id: string;
  urgency: ReportUrgency;
  status: ReportStatus;
  pain_level: number | null;
  description_preview: string;
  submitted_at: string;
  provider_first_name: string;
  provider_last_name: string;
  response_count: number;
};

export type ReportDetail = {
  id: string;
  provider_id: string;
  urgency: ReportUrgency;
  pain_level: number | null;
  description: string;
  photo_url: string | null;
  period_start: string | null;
  period_end: string | null;
  patient_notes: string | null;
  status: ReportStatus;
  flagged: boolean;
  submitted_at: string;
  viewed_at: string | null;
  reviewed_at: string | null;
};

export type ReportResponse = {
  id: string;
  report_id: string;
  provider_id: string;
  message: string;
  responded_at: string;
};

export type SubmitReportInput = {
  provider_id: string;
  urgency: ReportUrgency;
  description: string;
  pain_level?: number | null;
  photo_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  patient_notes?: string | null;
};

type Meta = { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };

export async function listMyReports(params: { page?: number; limit?: number; urgency?: ReportUrgency } = {}) {
  const res = await api.get<{ data: ReportSummary[]; meta: Meta }>('/reports/mine', {
    query: { page: params.page ?? 1, limit: params.limit ?? 20, urgency: params.urgency },
  });
  return res;
}

export async function getReport(id: string): Promise<{ report: ReportDetail; responses: ReportResponse[] }> {
  const res = await api.get<{ data: { report: ReportDetail; responses: ReportResponse[] } }>(`/reports/${id}`);
  return res.data;
}

export async function submitReport(input: SubmitReportInput): Promise<ReportDetail> {
  const res = await api.post<{ data: ReportDetail }>('/reports', input);
  return res.data;
}
