import { api } from './api';

export type FieldDef = {
  type: 'scale' | 'checkbox' | 'text' | 'select' | 'number';
  label: string;
  options?: string[];
  required: boolean;
  order: number;
  min?: number;
  max?: number;
  placeholder?: string;
};

export type IntakeAssignment = {
  id: string;
  form_id: string;
  status: string;
  assigned_at: string;
  form_title: string;
  form_description: string | null;
  form_fields: FieldDef[];
  provider_name: string;
};

export async function getMyIntakeAssignments(): Promise<IntakeAssignment[]> {
  const res = await api.get<{ data: IntakeAssignment[] }>('/intake-forms/assignments/mine');
  return res.data;
}

export async function submitIntakeResponse(formId: string, answers: Array<{ field_label: string; field_type: string; value: unknown }>) {
  const res = await api.post(`/intake-forms/${formId}/responses`, { answers });
  return res;
}
