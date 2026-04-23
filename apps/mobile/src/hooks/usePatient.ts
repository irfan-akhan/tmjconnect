import { useQuery } from '@tanstack/react-query';
import {
  getExerciseAssignments,
  getNotifications,
  getPatientDashboard,
  getPatientLinks,
  getPatientMe,
  getRecentSymptoms,
  getSymptomCalendar,
  getSymptomStats,
} from '../lib/patient.api';

export const qk = {
  dashboard: ['patients', 'dashboard'] as const,
  me: ['patients', 'me'] as const,
  symptomStats: ['symptoms', 'stats'] as const,
  recentSymptoms: (limit: number) => ['symptoms', 'recent', limit] as const,
  symptomCalendar: (year: number, month: number) => ['symptoms', 'calendar', year, month] as const,
  assignments: ['exercises', 'assignments'] as const,
  notifications: (limit: number) => ['notifications', 'list', limit] as const,
  links: ['linking', 'links'] as const,
};

export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: getPatientDashboard });
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: getPatientMe });
export const useSymptomStats = () => useQuery({ queryKey: qk.symptomStats, queryFn: getSymptomStats });
export const useRecentSymptoms = (limit = 7) =>
  useQuery({ queryKey: qk.recentSymptoms(limit), queryFn: () => getRecentSymptoms(limit) });
export const useSymptomCalendar = (year: number, month: number) =>
  useQuery({ queryKey: qk.symptomCalendar(year, month), queryFn: () => getSymptomCalendar(year, month) });
export const useAssignments = () => useQuery({ queryKey: qk.assignments, queryFn: getExerciseAssignments });
export const useNotifications = (limit = 20) =>
  useQuery({ queryKey: qk.notifications(limit), queryFn: () => getNotifications(limit) });
export const usePatientLinks = () => useQuery({ queryKey: qk.links, queryFn: getPatientLinks });
