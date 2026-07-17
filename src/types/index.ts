// ─── Auth ────────────────────────────────────────────────────────────────────

export interface Provider {
  id: string
  fullName: string
  email: string
  specialties: string[]
  clinicName: string
  licenseNumber: string
  avatarUrl?: string
  mfaEnabled: boolean
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number  // unix timestamp
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export type PatientStatus = 'stable' | 'moderate' | 'urgent'

export interface Patient {
  id: string
  fullName: string
  email: string
  avatarUrl?: string
  linkedSince: string
  lastAppLogin: string | null
  latestPainLevel: number | null   // 0–10
  status: PatientStatus
  exerciseAdherence: number        // 0–100 %
  hasOpenUrgentReport: boolean
}

export interface PatientDetail extends Patient {
  treatmentSummary: string
  painTrend: PainDataPoint[]       // last 14 days
}

export interface PainDataPoint {
  date: string      // ISO date string
  painLevel: number
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'urgent' | 'concerning' | 'routine'
export type ReportStatus = 'unreviewed' | 'reviewed' | 'responded'

export interface Report {
  id: string
  patientId: string
  patientName: string
  urgency: UrgencyLevel
  status: ReportStatus
  painScore: number
  description: string
  photoUrl?: string
  submittedAt: string
  respondedAt?: string
  isFlagged: boolean
  providerNote?: string    // internal note, not visible to patient
}

// ─── Exercises ───────────────────────────────────────────────────────────────

export type ExerciseCategory =
  | 'jaw_mobility'
  | 'muscle_relaxation'
  | 'posture'
  | 'breathing'
  | 'stretching'

export interface ExerciseVideo {
  id: string
  title: string
  description: string
  category: ExerciseCategory
  durationSeconds: number
  thumbnailUrl?: string
  videoUrl: string
  uploadedAt: string
}

export interface ExerciseAssignment {
  id: string
  exerciseId: string
  exerciseTitle: string
  patientId: string
  patientName: string
  frequency: string   // e.g. "2x per day", "daily"
  assignedAt: string
  completionRate: number   // 0–100 %
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'urgent_report'
  | 'concerning_report'
  | 'patient_inactive'
  | 'invite_accepted'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  isRead: boolean
  createdAt: string
  linkTo?: string   // route to navigate to
}

// ─── Invite / Linking ────────────────────────────────────────────────────────

export type InviteStatus = 'pending' | 'accepted' | 'expired'

export interface PatientInvite {
  id: string
  code: string          // 6-char alphanumeric
  email?: string
  status: InviteStatus
  createdAt: string
  expiresAt: string
}

// ─── API response wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
}
