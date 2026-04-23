import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PatientsResponse } from './types';

export type PatientListParams = {
  page: number;
  limit: number;
  search?: string;
};

export function usePatients(params: PatientListParams) {
  return useQuery({
    queryKey: ['patients', params],
    queryFn: () =>
      apiFetch<PatientsResponse>('/providers/patients', {
        query: {
          page: params.page,
          limit: params.limit,
          search: params.search || undefined,
        },
      }),
    placeholderData: keepPreviousData,
  });
}
