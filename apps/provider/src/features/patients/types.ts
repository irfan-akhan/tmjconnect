export type PatientRow = {
  patient_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  linked_at: string;
  last_symptom_at: string | null;
  avg_pain_7d: number | null;
  exercises_completed_7d: number;
};

export type PatientsResponse = {
  data: PatientRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
