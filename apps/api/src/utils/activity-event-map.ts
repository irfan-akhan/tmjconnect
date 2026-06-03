/**
 * Activity event mapping — maps audit action strings to user-friendly display properties.
 * Used to enrich API responses with titles and categories for client-side rendering.
 * 
 * IMPORTANT: This map covers patient and provider-facing events. Admin-only and
 * system events are included for completeness but may not be shown to end users.
 */

export type ActivityCategory = 'auth' | 'security' | 'account' | 'success' | 'failure' | 'view' | 'create' | 'update' | 'delete' | 'admin';

export interface ActivityEventConfig {
  title: string;
  category: ActivityCategory;
  description?: string;
}

export const ACTIVITY_EVENT_MAP: Record<string, ActivityEventConfig> = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTH EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'auth.patient_registered': {
    title: 'Account created',
    category: 'success',
    description: 'Patient account registered',
  },
  'auth.provider_registered': {
    title: 'Provider account created',
    category: 'success',
    description: 'Provider account registered',
  },
  'auth.login.success': {
    title: 'Signed in',
    category: 'success',
    description: 'Successfully logged in',
  },
  'auth.login.failed': {
    title: 'Failed login attempt',
    category: 'failure',
    description: 'Login failed',
  },
  'auth.logout': {
    title: 'Signed out',
    category: 'auth',
    description: 'Logged out from this device',
  },
  'auth.logout_all': {
    title: 'Signed out everywhere',
    category: 'security',
    description: 'Logged out from all devices',
  },
  'auth.password_reset': {
    title: 'Password reset',
    category: 'security',
    description: 'Password changed via reset link',
  },
  'auth.password_reset_requested': {
    title: 'Password reset requested',
    category: 'account',
    description: 'Password reset email sent',
  },
  'auth.password_reset_code_verified': {
    title: 'Reset code verified',
    category: 'success',
    description: 'Password reset code confirmed',
  },
  'auth.password_reset_confirmed': {
    title: 'Password reset confirmed',
    category: 'success',
    description: 'New password set',
  },
  'auth.change_password': {
    title: 'Password changed',
    category: 'security',
    description: 'Password updated from account settings',
  },
  'auth.mfa_init': {
    title: '2FA setup started',
    category: 'security',
    description: 'Two-factor authentication setup initiated',
  },
  'auth.mfa_setup_started': {
    title: '2FA configuration started',
    category: 'security',
    description: 'MFA setup in progress',
  },
  'auth.mfa_enabled': {
    title: 'Two-factor authentication enabled',
    category: 'security',
    description: '2FA turned on',
  },
  'auth.mfa_disabled': {
    title: 'Two-factor authentication disabled',
    category: 'account',
    description: '2FA turned off',
  },
  'auth.mfa_verify': {
    title: 'Two-factor code verified',
    category: 'success',
    description: '2FA authentication completed',
  },
  'auth.verify_email': {
    title: 'Email verified',
    category: 'success',
    description: 'Account email confirmed',
  },
  'auth.email_change_requested': {
    title: 'Email change requested',
    category: 'account',
    description: 'New email verification sent',
  },
  'auth.email_change_verified': {
    title: 'Email address changed',
    category: 'account',
    description: 'Email successfully updated',
  },
  'auth.tos_accepted': {
    title: 'Terms accepted',
    category: 'account',
    description: 'Agreed to terms of service',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SESSION EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'session_revoked': {
    title: 'Session ended',
    category: 'security',
    description: 'Session was terminated',
  },
  'admin_session_terminated': {
    title: 'Session terminated (admin)',
    category: 'admin',
    description: 'Session ended by administrator',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACCOUNT & PROFILE EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'profile_updated': {
    title: 'Profile updated',
    category: 'account',
    description: 'Account information changed',
  },
  'provider_profile_updated': {
    title: 'Profile updated',
    category: 'account',
    description: 'Provider information changed',
  },
  'account_deletion_requested': {
    title: 'Account deletion requested',
    category: 'account',
    description: 'Account scheduled for deletion',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // LINKING & CONNECTING
  // ═══════════════════════════════════════════════════════════════════════════════
  'linking_code_accepted': {
    title: 'Account linked',
    category: 'account',
    description: 'Connected to provider account',
  },
  'link_disconnected': {
    title: 'Account unlinked',
    category: 'account',
    description: 'Disconnected from provider',
  },
  'provider_updated_patient_link': {
    title: 'Patient link updated',
    category: 'update',
    description: 'Patient-provider link modified',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SYMPTOM LOG EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'symptom_log_upserted': {
    title: 'Symptom logged',
    category: 'create',
    description: 'Symptom entry created or updated',
  },
  'symptom_logs_viewed': {
    title: 'Symptom history viewed',
    category: 'view',
    description: 'Viewed symptom logs',
  },
  'symptom_log_viewed': {
    title: 'Symptom entry viewed',
    category: 'view',
    description: 'Opened symptom log detail',
  },
  'symptom_log_updated': {
    title: 'Symptom entry updated',
    category: 'update',
    description: 'Modified symptom log',
  },
  'symptom_log_deleted': {
    title: 'Symptom entry deleted',
    category: 'delete',
    description: 'Removed symptom log',
  },
  'symptom_stats_viewed': {
    title: 'Symptom statistics viewed',
    category: 'view',
    description: 'Checked symptom analytics',
  },
  'symptom_calendar_viewed': {
    title: 'Symptom calendar viewed',
    category: 'view',
    description: 'Viewed monthly symptom calendar',
  },
  'symptom_insights_viewed': {
    title: 'Symptom insights viewed',
    category: 'view',
    description: 'Checked symptom insights',
  },
  'symptom_correlation_viewed': {
    title: 'Symptom correlation viewed',
    category: 'view',
    description: 'Analyzed symptom correlations',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXERCISE & ASSIGNMENT EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'patient_viewed_assignments': {
    title: 'Exercise assignments viewed',
    category: 'view',
    description: 'Viewed active exercises',
  },
  'exercise_completed': {
    title: 'Exercise completed',
    category: 'success',
    description: 'Marked exercise as done',
  },
  'provider_viewed_patient_assignments': {
    title: 'Patient assignments viewed',
    category: 'view',
    description: 'Viewed patient exercise assignments',
  },
  'assignment_created': {
    title: 'Exercise assigned',
    category: 'create',
    description: 'New exercise assigned to patient',
  },
  'assignment_updated': {
    title: 'Assignment updated',
    category: 'update',
    description: 'Exercise assignment modified',
  },
  'assignment_deleted': {
    title: 'Assignment removed',
    category: 'delete',
    description: 'Exercise assignment deleted',
  },
  'provider_exercises_viewed': {
    title: 'Exercise library viewed',
    category: 'view',
    description: 'Browsed exercise catalog',
  },
  'exercise_created': {
    title: 'Exercise created',
    category: 'create',
    description: 'New exercise added to library',
  },
  'exercise_updated': {
    title: 'Exercise updated',
    category: 'update',
    description: 'Exercise modified',
  },
  'exercise_deleted': {
    title: 'Exercise deleted',
    category: 'delete',
    description: 'Exercise removed from library',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // REPORT EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'report_submitted': {
    title: 'Report submitted',
    category: 'success',
    description: 'Assessment report submitted',
  },
  'report_viewed': {
    title: 'Report viewed',
    category: 'view',
    description: 'Opened report detail',
  },
  'report_responded': {
    title: 'Report responded',
    category: 'create',
    description: 'Provider responded to report',
  },
  'report_reviewed': {
    title: 'Report reviewed',
    category: 'update',
    description: 'Report marked as reviewed',
  },
  'report_flagged': {
    title: 'Report flagged',
    category: 'update',
    description: 'Report flagged for attention',
  },
  'provider_viewed_report_inbox': {
    title: 'Report inbox viewed',
    category: 'view',
    description: 'Checked incoming reports',
  },
  'provider_marked_inbox_viewed': {
    title: 'Reports marked as viewed',
    category: 'update',
    description: 'Inbox marked as viewed',
  },
  'patient_viewed_own_reports': {
    title: 'Your reports viewed',
    category: 'view',
    description: 'Checked submitted reports',
  },
  'report_requests_listed': {
    title: 'Report requests viewed',
    category: 'view',
    description: 'Viewed pending report requests',
  },
  'report_request_created': {
    title: 'Report requested',
    category: 'create',
    description: 'Provider requested new report',
  },
  'report_request_dismissed': {
    title: 'Report request dismissed',
    category: 'update',
    description: 'Report request archived',
  },
  'provider_viewed_patient_reports': {
    title: 'Patient reports viewed',
    category: 'view',
    description: 'Reviewed patient reports',
  },
  'report_created_on_behalf': {
    title: 'Report created (on behalf)',
    category: 'create',
    description: 'Provider submitted report for patient',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLINICAL NOTES & ASSESSMENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'provider_listed_notes': {
    title: 'Clinical notes viewed',
    category: 'view',
    description: 'Reviewed clinical notes',
  },
  'clinical_note_created': {
    title: 'Clinical note created',
    category: 'create',
    description: 'Added new clinical note',
  },
  'clinical_note_updated': {
    title: 'Clinical note updated',
    category: 'update',
    description: 'Modified clinical note',
  },
  'clinical_note_deleted': {
    title: 'Clinical note deleted',
    category: 'delete',
    description: 'Removed clinical note',
  },
  'provider_viewed_last_clinic_visit': {
    title: 'Clinic visit history viewed',
    category: 'view',
    description: 'Checked last clinic visit',
  },
  'provider_recorded_clinic_visit': {
    title: 'Clinic visit recorded',
    category: 'create',
    description: 'Documented clinic visit',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TRACKING EVENTS (Mobility, Medication, Sleep)
  // ═══════════════════════════════════════════════════════════════════════════════
  'mobility_logged': {
    title: 'Jaw mobility logged',
    category: 'create',
    description: 'Recorded jaw mobility measurement',
  },
  'mobility_list_viewed': {
    title: 'Mobility history viewed',
    category: 'view',
    description: 'Checked jaw mobility logs',
  },
  'mobility_trend_viewed': {
    title: 'Mobility trend viewed',
    category: 'view',
    description: 'Analyzed mobility trends',
  },
  'medication_logged': {
    title: 'Medication logged',
    category: 'create',
    description: 'Recorded medication use',
  },
  'medication_list_viewed': {
    title: 'Medication history viewed',
    category: 'view',
    description: 'Checked medication logs',
  },
  'medication_correlation_viewed': {
    title: 'Medication correlation viewed',
    category: 'view',
    description: 'Analyzed medication correlations',
  },
  'sleep_logged': {
    title: 'Sleep logged',
    category: 'create',
    description: 'Recorded sleep data',
  },
  'sleep_list_viewed': {
    title: 'Sleep history viewed',
    category: 'view',
    description: 'Checked sleep logs',
  },
  'sleep_correlation_viewed': {
    title: 'Sleep correlation viewed',
    category: 'view',
    description: 'Analyzed sleep correlations',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // REMINDER & NOTIFICATION EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'reminders_viewed': {
    title: 'Reminders viewed',
    category: 'view',
    description: 'Checked reminders',
  },
  'reminder_created': {
    title: 'Reminder created',
    category: 'create',
    description: 'New reminder set',
  },
  'reminder_updated': {
    title: 'Reminder updated',
    category: 'update',
    description: 'Reminder modified',
  },
  'reminder_deleted': {
    title: 'Reminder deleted',
    category: 'delete',
    description: 'Reminder removed',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTAKE FORMS
  // ═══════════════════════════════════════════════════════════════════════════════
  'intake_form_created': {
    title: 'Intake form created',
    category: 'create',
    description: 'New intake form added',
  },
  'intake_forms_listed': {
    title: 'Intake forms viewed',
    category: 'view',
    description: 'Browsed intake forms',
  },
  'intake_form_viewed': {
    title: 'Intake form viewed',
    category: 'view',
    description: 'Opened intake form',
  },
  'intake_form_updated': {
    title: 'Intake form updated',
    category: 'update',
    description: 'Modified intake form',
  },
  'intake_form_deleted': {
    title: 'Intake form deleted',
    category: 'delete',
    description: 'Removed intake form',
  },
  'intake_form_assigned': {
    title: 'Intake form assigned',
    category: 'create',
    description: 'Assigned intake form to patient',
  },
  'intake_responses_viewed': {
    title: 'Intake responses viewed',
    category: 'view',
    description: 'Reviewed intake responses',
  },
  'patient_intake_assignments_viewed': {
    title: 'Intake assignments viewed',
    category: 'view',
    description: 'Checked pending intake forms',
  },
  'intake_response_submitted': {
    title: 'Intake form submitted',
    category: 'success',
    description: 'Completed intake form',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUPPORT & COMMUNICATION
  // ═══════════════════════════════════════════════════════════════════════════════
  'support_ticket_created': {
    title: 'Support ticket created',
    category: 'create',
    description: 'Opened support request',
  },
  'support_tickets_viewed': {
    title: 'Support tickets viewed',
    category: 'view',
    description: 'Checked support requests',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PATIENT DASHBOARD EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'patient_dashboard_viewed': {
    title: 'Dashboard viewed',
    category: 'view',
    description: 'Accessed patient dashboard',
  },
  'patient_profile_viewed': {
    title: 'Profile viewed',
    category: 'view',
    description: 'Viewed profile settings',
  },
  'patient_sessions_viewed': {
    title: 'Active sessions viewed',
    category: 'view',
    description: 'Checked logged-in devices',
  },
  'patient_activity_viewed': {
    title: 'Activity log viewed',
    category: 'view',
    description: 'Reviewed account activity',
  },
  'patient_notification_prefs_viewed': {
    title: 'Notification preferences viewed',
    category: 'view',
    description: 'Checked notification settings',
  },
  'patient_data_exported': {
    title: 'Data exported',
    category: 'account',
    description: 'Downloaded personal data',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROVIDER DASHBOARD & ANALYTICS EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'provider_dashboard_viewed': {
    title: 'Dashboard viewed',
    category: 'view',
    description: 'Accessed provider dashboard',
  },
  'provider_analytics_viewed': {
    title: 'Analytics viewed',
    category: 'view',
    description: 'Reviewed analytics',
  },
  'provider_profile_viewed': {
    title: 'Profile viewed',
    category: 'view',
    description: 'Viewed profile settings',
  },
  'provider_billing_viewed': {
    title: 'Billing information viewed',
    category: 'view',
    description: 'Checked billing details',
  },
  'provider_sessions_viewed': {
    title: 'Active sessions viewed',
    category: 'view',
    description: 'Checked logged-in devices',
  },
  'provider_activity_viewed': {
    title: 'Activity log viewed',
    category: 'view',
    description: 'Reviewed activity history',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROVIDER PATIENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════
  'provider_listed_patients': {
    title: 'Patient list viewed',
    category: 'view',
    description: 'Browsed patient list',
  },
  'provider_viewed_patient_detail': {
    title: 'Patient detail viewed',
    category: 'view',
    description: 'Opened patient profile',
  },
  'provider_viewed_patient_symptoms': {
    title: 'Patient symptoms viewed',
    category: 'view',
    description: 'Reviewed patient symptom logs',
  },
  'provider_viewed_patient_analytics': {
    title: 'Patient analytics viewed',
    category: 'view',
    description: 'Analyzed patient data',
  },
  'provider_listed_report_requests': {
    title: 'Report requests viewed',
    category: 'view',
    description: 'Checked pending report requests',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ADMIN EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  'admin_viewed_analytics': {
    title: 'Platform analytics viewed',
    category: 'admin',
    description: 'Reviewed system analytics',
  },
  'admin_listed_users': {
    title: 'User list viewed',
    category: 'admin',
    description: 'Browsed all users',
  },
  'admin_viewed_user': {
    title: 'User detail viewed',
    category: 'admin',
    description: 'Reviewed user profile',
  },
  'admin_user_updated': {
    title: 'User updated',
    category: 'admin',
    description: 'Modified user account',
  },
  'admin_viewed_audit_logs': {
    title: 'Audit logs viewed',
    category: 'admin',
    description: 'Reviewed system audit trail',
  },
  'admin_audit_export': {
    title: 'Audit logs exported',
    category: 'admin',
    description: 'Downloaded audit report',
  },
  'admin_viewed_login_events': {
    title: 'Login events viewed',
    category: 'admin',
    description: 'Reviewed login history',
  },
  'admin_viewed_all_reports': {
    title: 'All reports viewed',
    category: 'admin',
    description: 'Reviewed system reports',
  },
  'admin_outbox_retried': {
    title: 'Notification retried',
    category: 'admin',
    description: 'Retried failed notification',
  },
  'admin_outbox_dropped': {
    title: 'Notification dropped',
    category: 'admin',
    description: 'Removed notification from queue',
  },
  'admin_job_triggered': {
    title: 'System job triggered',
    category: 'admin',
    description: 'Manually executed background job',
  },
  'admin_viewed_provider_performance': {
    title: 'Provider performance viewed',
    category: 'admin',
    description: 'Reviewed provider metrics',
  },
  'admin_viewed_patient_engagement': {
    title: 'Patient engagement viewed',
    category: 'admin',
    description: 'Analyzed patient engagement',
  },
  'admin_viewed_security_summary': {
    title: 'Security summary viewed',
    category: 'admin',
    description: 'Reviewed security metrics',
  },
  'admin_viewed_phi_access_by_actor': {
    title: 'PHI access by user viewed',
    category: 'admin',
    description: 'Reviewed user PHI access logs',
  },
  'admin_viewed_phi_access_by_resource': {
    title: 'PHI access by resource viewed',
    category: 'admin',
    description: 'Reviewed resource-level PHI access',
  },

  // ─── Fallback ────────────────────────────────────────────────────────────────
};

/**
 * Get activity event configuration by action string.
 * Falls back to a generic config if action not found.
 */
export function getActivityEventConfig(action: string): ActivityEventConfig {
  return (
    ACTIVITY_EVENT_MAP[action] ?? {
      title: action.replace(/[._]/g, ' '),
      category: 'auth' as const,
      description: undefined,
    }
  );
}
