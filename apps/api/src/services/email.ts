import type { Env } from '../config/env';
import type { Logger } from '../config/logger';
import { createCircuitBreaker } from './circuitBreaker';

export interface EmailService {
  sendVerifyEmail(to: string, code: string): Promise<void>;
  sendWelcome(to: string, firstName: string): Promise<void>;
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
  sendPasswordResetCode(to: string, code: string): Promise<void>;
  sendNewDeviceLogin(to: string, firstName: string, ip: string, device: string): Promise<void>;
  sendAccountLocked(to: string, firstName: string): Promise<void>;
  sendPasswordChanged(to: string, firstName: string): Promise<void>;
  sendEmailChanged(to: string, firstName: string, newEmail: string): Promise<void>;
  sendMfaEnabled(to: string, firstName: string): Promise<void>;
  sendMfaDisabled(to: string, firstName: string): Promise<void>;
  sendSessionsRevoked(to: string, firstName: string): Promise<void>;
  sendProviderMessage(to: string, patientName: string, message: string): Promise<void>;
  sendLinkAccepted(to: string, providerName: string, patientName: string, recipientRole?: 'provider' | 'patient'): Promise<void>;
  sendLinkDisconnected(to: string, firstName: string, otherPartyName: string): Promise<void>;
  sendExerciseAssigned(to: string, patientName: string, exerciseTitle: string, frequency: string, sets: number): Promise<void>;
  sendReportSubmitted(to: string, providerName: string, patientName: string, urgency: string): Promise<void>;
  sendReportRequested(to: string, patientName: string, prompt: string): Promise<void>;
  sendReportReviewed(to: string, patientName: string): Promise<void>;
  sendWeeklyDigest(to: string, patientName: string, stats: WeeklyDigestStats): Promise<void>;
  sendEmailInvite(to: string, providerName: string, code: string): Promise<void>;
  sendEmailChangeCode(to: string, code: string): Promise<void>;
  sendSupportTicketReceived(to: string, firstName: string, ticketId: string, subject: string): Promise<void>;
  sendDataExported(to: string, firstName: string): Promise<void>;
  sendAccountDeleted(to: string, firstName: string): Promise<void>;
  sendAccountRestoreApproved(to: string, firstName: string): Promise<void>;
  sendBroadcast(to: string, title: string, body: string, type: 'announcement' | 'system'): Promise<void>;
}

export interface WeeklyDigestStats {
  avgPainLevel: number;
  exercisesCompleted: number;
  completionRate: number;
  streakDays: number;
}

// ─── HTML escaping ────────────────────────────────────────────────────────────────
/**
 * Escapes user-supplied strings before interpolation into HTML email templates.
 * Prevents XSS via names like '<img src=x onerror=...>' in greetings.
 */
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function cleanSubject(s: string): string {
  const subject = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return subject.length > 120 ? `${subject.slice(0, 117)}...` : subject;
}

function plain(s: string): string {
  return s.replace(/[\r\t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Branding ─────────────────────────────────────────────────────────────────────
const BRAND_NAVY = '#1B2A4A';
const BRAND_GOLD = '#D4AF37';

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TMJConnect</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="background:${BRAND_NAVY};padding:24px 32px;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:bold;">TMJConnect</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f5f5f5;padding:16px 32px;text-align:center;">
              <p style="margin:0;color:#888;font-size:12px;">
                <em>Care Beyond the Chair</em><br>
                This message was sent by TMJConnect.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function ctaButton(href: string, text: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_GOLD};color:${BRAND_NAVY};font-weight:bold;padding:12px 24px;border-radius:4px;text-decoration:none;margin:16px 0;">${text}</a>`;
}

function secondaryNote(text: string): string {
  return `<p style="color:#666;font-size:13px;line-height:1.5;">${text}</p>`;
}

function htmlToText(html: string): string {
  return plain(html
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&middot;/g, '-')
    .replace(/[ \u00a0]{2,}/g, ' '));
}

// ─── Email templates ──────────────────────────────────────────────────────────────

function templates(appUrl: string) {
  return {
    verifyEmail: (code: string) => ({
      subject: 'Verify your TMJConnect email address',
      html: baseTemplate(`
        <h2 style="color:${BRAND_NAVY};">Verify your email</h2>
        <p style="line-height:1.6;color:#333;">Use this code to confirm your email address and finish securing your TMJConnect account.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND_NAVY};text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
          ${code}
        </div>
        ${secondaryNote('This code expires in 5 minutes. If you did not create a TMJConnect account, you can safely ignore this email.')}
      `),
    }),

    emailChangeCode: (code: string) => ({
      subject: 'Confirm your new TMJConnect email',
      html: baseTemplate(`
        <h2 style="color:${BRAND_NAVY};">Confirm your new email</h2>
        <p style="line-height:1.6;color:#333;">Enter this code in TMJConnect to finish changing the email address used for sign-in and account alerts.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND_NAVY};text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
          ${code}
        </div>
        ${secondaryNote("This code expires in 5 minutes. If you didn't request an email change, your current email stays active and no action is needed.")}
      `),
    }),

    welcome: (firstName: string) => {
      const name = escHtml(firstName);
      return {
        subject: 'Welcome to TMJConnect',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Welcome, ${name}!</h2>
          <p style="line-height:1.6;color:#333;">Your account is ready. TMJConnect helps you track symptoms, complete assigned exercises, and stay connected with your care team between visits.</p>
          ${ctaButton(`${appUrl}/login`, 'Open TMJConnect')}
        `),
      };
    },

    passwordReset: (resetUrl: string) => ({
      subject: 'Reset your TMJConnect password',
      html: baseTemplate(`
        <h2 style="color:${BRAND_NAVY};">Reset your password</h2>
        <p style="line-height:1.6;color:#333;">Use the secure link below to choose a new TMJConnect password. This link expires in 1 hour.</p>
        ${ctaButton(resetUrl, 'Reset Password')}
        ${secondaryNote('If you did not request a password reset, you can safely ignore this email.')}
      `),
    }),

    passwordResetCode: (code: string) => ({
      subject: 'Your TMJConnect password reset code',
      html: baseTemplate(`
        <h2 style="color:${BRAND_NAVY};">Reset your password</h2>
        <p style="line-height:1.6;color:#333;">Enter this code in TMJConnect to continue resetting your password.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND_NAVY};text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
          ${code}
        </div>
        ${secondaryNote('This code expires in 5 minutes. If you did not request a password reset, you can safely ignore this email.')}
      `),
    }),

    newDeviceLogin: (firstName: string, ip: string, device: string) => {
      const name = escHtml(firstName);
      const safeIp = escHtml(ip);
      const safeDevice = escHtml(device.substring(0, 100));
      return {
        subject: 'New device login on your TMJConnect account',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">New login detected</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, we noticed a sign-in to your TMJConnect account from a device we have not seen before.</p>
          <table style="background:#f5f5f5;padding:16px;border-radius:4px;width:100%;">
            <tr><td><strong>IP Address:</strong></td><td>${safeIp}</td></tr>
            <tr><td><strong>Device:</strong></td><td>${safeDevice}</td></tr>
          </table>
          <p style="line-height:1.6;color:#333;">If this was you, no action is needed. If you do not recognize this sign-in, review your account security and update your password.</p>
          ${ctaButton(`${appUrl}/settings/security`, 'Review Account Security')}
        `),
      };
    },

    accountLocked: (firstName: string) => {
      const name = escHtml(firstName);
      return {
        subject: 'Your TMJConnect account has been temporarily locked',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Account temporarily locked</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, we temporarily locked your account after several unsuccessful sign-in attempts.</p>
          <p style="line-height:1.6;color:#333;">Your account will unlock automatically in 30 minutes. If you were trying to sign in and forgot your password, you can reset it now.</p>
          ${ctaButton(`${appUrl}/forgot-password`, 'Reset Password')}
        `),
      };
    },

    passwordChanged: (firstName: string) => {
      const name = escHtml(firstName || 'there');
      return {
        subject: 'Your TMJConnect password was changed',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Password changed</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, the password for your TMJConnect account was changed successfully.</p>
          ${secondaryNote('If you made this change, no action is needed. If you did not make this change, reset your password immediately and contact support.')}
          ${ctaButton(`${appUrl}/forgot-password`, 'Reset Password')}
        `),
      };
    },

    emailChanged: (firstName: string, newEmail: string) => {
      const name = escHtml(firstName || 'there');
      const safeEmail = escHtml(newEmail);
      return {
        subject: 'Your TMJConnect email was changed',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Email address changed</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, the sign-in email for your TMJConnect account was changed to <strong>${safeEmail}</strong>.</p>
          ${secondaryNote('If you made this change, no action is needed. If you did not make this change, reset your password and contact support.')}
          ${ctaButton(`${appUrl}/forgot-password`, 'Secure My Account')}
        `),
      };
    },

    mfaEnabled: (firstName: string) => {
      const name = escHtml(firstName || 'there');
      return {
        subject: 'Multi-factor authentication is now enabled',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">MFA enabled</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, multi-factor authentication is now enabled on your TMJConnect account.</p>
          ${secondaryNote('Keep your backup codes in a safe place. TMJConnect will never ask you to share them by email, phone, or text message.')}
        `),
      };
    },

    mfaDisabled: (firstName: string) => {
      const name = escHtml(firstName || 'there');
      return {
        subject: 'Multi-factor authentication was disabled',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">MFA disabled</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, multi-factor authentication was disabled for your TMJConnect account.</p>
          ${secondaryNote('If you did not disable MFA, reset your password immediately and contact support.')}
          ${ctaButton(`${appUrl}/settings/security`, 'Review Security Settings')}
        `),
      };
    },

    sessionsRevoked: (firstName: string) => {
      const name = escHtml(firstName || 'there');
      return {
        subject: 'Your TMJConnect sessions were updated',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Sessions updated</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, one or more signed-in sessions were removed from your TMJConnect account.</p>
          ${secondaryNote('If this was you, no action is needed. If you do not recognize this change, review your account security.')}
          ${ctaButton(`${appUrl}/settings/security`, 'Review Account Security')}
        `),
      };
    },

    providerMessage: (patientName: string, message: string) => {
      const patient = escHtml(patientName || 'there');
      const safeMessage = escHtml(message || 'Your provider has shared an update in TMJConnect.').replace(/\n/g, '<br>');
      return {
        subject: 'New update from your TMJConnect provider',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">New provider update</h2>
          <p style="line-height:1.6;color:#333;">Hi ${patient}, your provider shared an update in TMJConnect.</p>
          <div style="line-height:1.6;color:#333;background:#f5f5f5;border-left:4px solid ${BRAND_GOLD};padding:16px;margin:16px 0;">
            ${safeMessage}
          </div>
          ${ctaButton(appUrl, 'Open TMJConnect')}
          ${secondaryNote('For urgent symptoms or emergencies, contact your provider directly or seek immediate medical care.')}
        `),
      };
    },

    linkAccepted: (providerName: string, patientName: string, recipientRole: 'provider' | 'patient' = 'provider') => {
      const provider = escHtml(providerName);
      const patient = escHtml(patientName);
      if (recipientRole === 'patient') {
        return {
          subject: cleanSubject(`You are connected with ${providerName || 'your provider'} on TMJConnect`),
          html: baseTemplate(`
            <h2 style="color:${BRAND_NAVY};">Provider connected</h2>
            <p style="line-height:1.6;color:#333;">Hi ${patient || 'there'}, you are now connected with <strong>${provider || 'your provider'}</strong> in TMJConnect.</p>
            ${ctaButton(appUrl, 'Open TMJConnect')}
          `),
        };
      }
      return {
        subject: cleanSubject(`${patientName || 'A patient'} connected with you on TMJConnect`),
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Patient connected</h2>
          <p style="line-height:1.6;color:#333;">Hi ${provider || 'there'}, <strong>${patient || 'your patient'}</strong> accepted your invitation and is now connected to your TMJConnect portal.</p>
          ${ctaButton(`${appUrl}/portal/patients`, 'View Patient')}
        `),
      };
    },

    linkDisconnected: (firstName: string, otherPartyName: string) => {
      const name = escHtml(firstName || 'there');
      const otherParty = escHtml(otherPartyName || 'your connected care contact');
      return {
        subject: 'A TMJConnect care connection was removed',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Care connection removed</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, your TMJConnect connection with <strong>${otherParty}</strong> has been removed.</p>
          ${secondaryNote('They will no longer have access through TMJConnect to newly shared care updates from this connection.')}
          ${ctaButton(appUrl, 'Open TMJConnect')}
        `),
      };
    },

    exerciseAssigned: (patientName: string, exerciseTitle: string, frequency: string, sets: number) => {
      const patient = escHtml(patientName || 'there');
      const title = escHtml(exerciseTitle || 'a new exercise');
      const safeFrequency = escHtml(frequency || 'as assigned');
      return {
        subject: cleanSubject(`New exercise assigned: ${exerciseTitle || 'TMJConnect exercise'}`),
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">New exercise assigned</h2>
          <p style="line-height:1.6;color:#333;">Hi ${patient}, your provider assigned <strong>${title}</strong> in TMJConnect.</p>
          <table style="background:#f5f5f5;padding:16px;border-radius:4px;width:100%;">
            <tr><td><strong>Frequency:</strong></td><td>${safeFrequency}</td></tr>
            <tr><td><strong>Sets:</strong></td><td>${sets}</td></tr>
          </table>
          ${ctaButton(`${appUrl}/exercises`, 'View Exercise')}
          ${secondaryNote("Follow your provider's instructions and stop if an exercise causes unexpected pain or symptoms.")}
        `),
      };
    },

    reportSubmitted: (providerName: string, patientName: string, urgency: string) => {
      const provider = escHtml(providerName);
      const patient = escHtml(patientName);
      const safeUrgency = escHtml(urgency);
      const urgencyLabel = urgency === 'urgent' ? 'urgent' : urgency === 'concerning' ? 'concerning' : 'routine';
      return {
        subject: cleanSubject(`${urgency === 'urgent' ? 'Urgent report' : 'New patient report'} from ${patientName || 'a patient'}`),
        html: baseTemplate(`
          <h2 style="color:${urgency === 'urgent' ? '#c0392b' : BRAND_NAVY};">
            New ${escHtml(urgencyLabel)} report
          </h2>
          <p style="line-height:1.6;color:#333;">Hi ${provider || 'there'}, <strong>${patient || 'your patient'}</strong> submitted a ${safeUrgency || 'new'} TMJConnect report for your review.</p>
          ${urgency === 'urgent' ? '<p style="line-height:1.6;color:#c0392b;font-weight:bold;">This report was marked urgent. Please review it as soon as your workflow allows.</p>' : ''}
          ${ctaButton(`${appUrl}/portal/reports`, 'View Report')}
        `),
      };
    },

    reportRequested: (patientName: string, prompt: string) => {
      const patient = escHtml(patientName || 'there');
      const safePrompt = escHtml(prompt || 'Please complete a new TMJConnect report.').replace(/\n/g, '<br>');
      return {
        subject: 'Your provider requested a TMJConnect report',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Report requested</h2>
          <p style="line-height:1.6;color:#333;">Hi ${patient}, your provider requested an update through TMJConnect.</p>
          <div style="line-height:1.6;color:#333;background:#f5f5f5;border-left:4px solid ${BRAND_GOLD};padding:16px;margin:16px 0;">
            ${safePrompt}
          </div>
          ${ctaButton(`${appUrl}/reports/new`, 'Complete Report')}
          ${secondaryNote('If you have urgent symptoms or need immediate care, contact your provider directly.')}
        `),
      };
    },

    reportReviewed: (patientName: string) => {
      const patient = escHtml(patientName);
      return {
        subject: 'Your TMJConnect report was reviewed',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Report reviewed</h2>
          <p style="line-height:1.6;color:#333;">Hi ${patient || 'there'}, your provider reviewed your recent TMJConnect report. Open the app to see any notes or next steps.</p>
          ${ctaButton(`${appUrl}/reports`, 'View Report')}
        `),
      };
    },

    weeklyDigest: (patientName: string, stats: WeeklyDigestStats) => {
      const patient = escHtml(patientName);
      return {
        subject: 'Your TMJConnect weekly summary',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Your weekly TMJConnect summary</h2>
          <p style="line-height:1.6;color:#333;">Hi ${patient || 'there'}, here is a quick look at your TMJConnect activity from the past week.</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:12px;background:#f5f5f5;border-radius:4px;text-align:center;">
                <div style="font-size:24px;font-weight:bold;color:${BRAND_NAVY};">${stats.avgPainLevel.toFixed(1)}</div>
                <div style="font-size:12px;color:#888;">Avg Pain Level</div>
              </td>
              <td style="padding:12px;background:#f5f5f5;border-radius:4px;text-align:center;">
                <div style="font-size:24px;font-weight:bold;color:${BRAND_NAVY};">${stats.exercisesCompleted}</div>
                <div style="font-size:12px;color:#888;">Exercises Done</div>
              </td>
              <td style="padding:12px;background:#f5f5f5;border-radius:4px;text-align:center;">
                <div style="font-size:24px;font-weight:bold;color:${BRAND_NAVY};">${stats.completionRate}%</div>
                <div style="font-size:12px;color:#888;">Completion Rate</div>
              </td>
              <td style="padding:12px;background:#f5f5f5;border-radius:4px;text-align:center;">
                <div style="font-size:24px;font-weight:bold;color:${BRAND_GOLD};">${stats.streakDays}</div>
                <div style="font-size:12px;color:#888;">Day Streak</div>
              </td>
            </tr>
          </table>
          ${ctaButton(appUrl, 'Open TMJConnect')}
        `),
      };
    },

    emailInvite: (providerName: string, code: string) => {
      const provider = escHtml(providerName);
      return {
        subject: cleanSubject(`${providerName || 'Your provider'} invited you to TMJConnect`),
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Connect with your provider</h2>
          <p style="line-height:1.6;color:#333;"><strong>${provider || 'Your provider'}</strong> invited you to use TMJConnect for symptom tracking, exercises, and care updates between visits.</p>
          <p style="line-height:1.6;color:#333;">Open TMJConnect and enter this connection code:</p>
          <div style="font-size:28px;font-weight:bold;letter-spacing:6px;color:${BRAND_NAVY};text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
            ${code}
          </div>
          ${secondaryNote('This provider connection code expires in 7 days.')}
        `),
      };
    },

    supportTicketReceived: (firstName: string, ticketId: string, subject: string) => {
      const name = escHtml(firstName || 'there');
      const safeTicketId = escHtml(ticketId);
      const safeSubject = escHtml(subject || 'Support request');
      return {
        subject: cleanSubject(`We received your TMJConnect support request: ${subject || ticketId}`),
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Support request received</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, we received your support request and logged it for review.</p>
          <table style="background:#f5f5f5;padding:16px;border-radius:4px;width:100%;">
            <tr><td><strong>Ticket:</strong></td><td>${safeTicketId}</td></tr>
            <tr><td><strong>Subject:</strong></td><td>${safeSubject}</td></tr>
          </table>
          ${secondaryNote('You can view your support requests in TMJConnect. We will follow up if more information is needed.')}
        `),
      };
    },

    dataExported: (firstName: string) => {
      const name = escHtml(firstName || 'there');
      return {
        subject: 'Your TMJConnect data export was generated',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Data export generated</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, your TMJConnect data export was generated from your account.</p>
          ${secondaryNote('If you requested this export, no action is needed. If you did not request it, review your account security and contact support.')}
          ${ctaButton(`${appUrl}/settings/security`, 'Review Account Security')}
        `),
      };
    },

    accountDeleted: (firstName: string) => {
      const name = escHtml(firstName || 'there');
      return {
        subject: 'Your TMJConnect account was deleted',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Account deleted</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, your TMJConnect account deletion request has been completed.</p>
          ${secondaryNote('You will no longer be able to sign in with this account. If you did not request this deletion, contact support as soon as possible.')}
        `),
      };
    },

    accountRestoreApproved: (firstName: string) => {
      const name = escHtml(firstName || 'there');
      return {
        subject: 'Your TMJConnect account has been restored',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Account restored</h2>
          <p style="line-height:1.6;color:#333;">Hi ${name}, your TMJConnect account restoration request was approved.</p>
          ${secondaryNote('You can now sign in again with your existing email and password.')}
          ${ctaButton(appUrl, 'Sign in to TMJConnect')}
        `),
      };
    },

    broadcast: (title: string, body: string, type: 'announcement' | 'system') => {
      const safeTitle = escHtml(title);
      const safeBody = escHtml(body).replace(/\n/g, '<br>');
      const headingColor = type === 'system' ? '#c0392b' : BRAND_NAVY;
      return {
        subject: cleanSubject(title),
        html: baseTemplate(`
          <h2 style="color:${headingColor};">${safeTitle}</h2>
          <p style="line-height:1.6;color:#333;">${safeBody}</p>
          ${ctaButton(appUrl, 'Open TMJConnect')}
        `),
      };
    },
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────────

/**
 * Creates the email service backed by Twilio SendGrid.
 * If SENDGRID_API_KEY is absent in development: logs to console (stub mode).
 * If SENDGRID_API_KEY is absent in production: throws on any send attempt.
 */
export function createEmailService(env: Env, logger: Logger): EmailService {
  const isProduction = env.NODE_ENV === 'production';
  const appUrl = env.APP_URL;

  if (!env.SENDGRID_API_KEY) {
    if (isProduction) {
      logger.error('SENDGRID_API_KEY is required in production. Email service will throw on use.');
    } else {
      logger.warn('[EmailService] SENDGRID_API_KEY not set — running in stub mode (console output).');
    }
  }

  // Lazy import SendGrid to avoid errors when API key is absent in development.
  // The SDK's CJS export is the singleton itself, not a `.default` wrapper.
  let sgMail: typeof import('@sendgrid/mail') | null = null;
  if (env.SENDGRID_API_KEY) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sgMail = require('@sendgrid/mail') as typeof import('@sendgrid/mail');
    sgMail.setApiKey(env.SENDGRID_API_KEY);
  }

  // SendGrid requires the `from` address to be verified (Single Sender or
  // domain-authenticated). Configurable per environment so test and prod can
  // use different verified senders.
  const fromAddress = env.SENDGRID_FROM ?? 'TMJConnect <noreply@mail.tmjconnect.com>';
  const tmpl = templates(appUrl);
  const breaker = createCircuitBreaker('email', logger);

  async function send(to: string, subject: string, html: string): Promise<void> {
    const safeSubject = cleanSubject(subject);
    const text = htmlToText(html);
    if (!sgMail) {
      if (isProduction) throw new Error('Email service not configured: SENDGRID_API_KEY missing.');
      logger.info({ to, subject: safeSubject }, '[EmailService stub] Email would be sent');
      return;
    }

    await breaker.execute(async () => {
      try {
        await sgMail!.send({ from: fromAddress, to, subject: safeSubject, html, text });
      } catch (err: unknown) {
        // SendGrid errors carry a `response.body.errors[]` array with detail.
        // Surface the first message for actionable logs without leaking PII.
        const message =
          (err as { response?: { body?: { errors?: Array<{ message?: string }> } } })
            ?.response?.body?.errors?.[0]?.message ??
          (err instanceof Error ? err.message : 'Unknown SendGrid error');
        throw new Error(`SendGrid error: ${message}`);
      }
    });
  }

  return {
    async sendVerifyEmail(to, code) {
      const { subject, html } = tmpl.verifyEmail(code);
      // Dev-only: surface the plaintext code so you can self-verify without a
      // real email provider. Stripped from prod output by the !isProduction guard.
      if (!sgMail && !isProduction) {
        logger.info({ to, code }, '[EmailService stub] Verify code (dev only)');
      }
      await send(to, subject, html);
    },
    async sendWelcome(to, firstName) {
      const { subject, html } = tmpl.welcome(firstName);
      await send(to, subject, html);
    },
    async sendPasswordReset(to, resetUrl) {
      const { subject, html } = tmpl.passwordReset(resetUrl);
      await send(to, subject, html);
    },
    async sendPasswordResetCode(to, code) {
      const { subject, html } = tmpl.passwordResetCode(code);
      if (!sgMail && !isProduction) {
        logger.info({ to, code }, '[EmailService stub] Password reset code (dev only)');
      }
      await send(to, subject, html);
    },
    async sendNewDeviceLogin(to, firstName, ip, device) {
      const { subject, html } = tmpl.newDeviceLogin(firstName, ip, device);
      await send(to, subject, html);
    },
    async sendAccountLocked(to, firstName) {
      const { subject, html } = tmpl.accountLocked(firstName);
      await send(to, subject, html);
    },
    async sendPasswordChanged(to, firstName) {
      const { subject, html } = tmpl.passwordChanged(firstName);
      await send(to, subject, html);
    },
    async sendEmailChanged(to, firstName, newEmail) {
      const { subject, html } = tmpl.emailChanged(firstName, newEmail);
      await send(to, subject, html);
    },
    async sendMfaEnabled(to, firstName) {
      const { subject, html } = tmpl.mfaEnabled(firstName);
      await send(to, subject, html);
    },
    async sendMfaDisabled(to, firstName) {
      const { subject, html } = tmpl.mfaDisabled(firstName);
      await send(to, subject, html);
    },
    async sendSessionsRevoked(to, firstName) {
      const { subject, html } = tmpl.sessionsRevoked(firstName);
      await send(to, subject, html);
    },
    async sendProviderMessage(to, patientName, message) {
      const { subject, html } = tmpl.providerMessage(patientName, message);
      await send(to, subject, html);
    },
    async sendLinkAccepted(to, providerName, patientName, recipientRole) {
      const { subject, html } = tmpl.linkAccepted(providerName, patientName, recipientRole);
      await send(to, subject, html);
    },
    async sendLinkDisconnected(to, firstName, otherPartyName) {
      const { subject, html } = tmpl.linkDisconnected(firstName, otherPartyName);
      await send(to, subject, html);
    },
    async sendExerciseAssigned(to, patientName, exerciseTitle, frequency, sets) {
      const { subject, html } = tmpl.exerciseAssigned(patientName, exerciseTitle, frequency, sets);
      await send(to, subject, html);
    },
    async sendReportSubmitted(to, providerName, patientName, urgency) {
      const { subject, html } = tmpl.reportSubmitted(providerName, patientName, urgency);
      await send(to, subject, html);
    },
    async sendReportRequested(to, patientName, prompt) {
      const { subject, html } = tmpl.reportRequested(patientName, prompt);
      await send(to, subject, html);
    },
    async sendReportReviewed(to, patientName) {
      const { subject, html } = tmpl.reportReviewed(patientName);
      await send(to, subject, html);
    },
    async sendWeeklyDigest(to, patientName, stats) {
      const { subject, html } = tmpl.weeklyDigest(patientName, stats);
      await send(to, subject, html);
    },
    async sendEmailInvite(to, providerName, code) {
      const { subject, html } = tmpl.emailInvite(providerName, code);
      await send(to, subject, html);
    },
    async sendEmailChangeCode(to, code) {
      const { subject, html } = tmpl.emailChangeCode(code);
      await send(to, subject, html);
    },
    async sendSupportTicketReceived(to, firstName, ticketId, subjectText) {
      const { subject, html } = tmpl.supportTicketReceived(firstName, ticketId, subjectText);
      await send(to, subject, html);
    },
    async sendDataExported(to, firstName) {
      const { subject, html } = tmpl.dataExported(firstName);
      await send(to, subject, html);
    },
    async sendAccountDeleted(to, firstName) {
      const { subject, html } = tmpl.accountDeleted(firstName);
      await send(to, subject, html);
    },
    async sendAccountRestoreApproved(to, firstName) {
      const { subject, html } = tmpl.accountRestoreApproved(firstName);
      await send(to, subject, html);
    },
    async sendBroadcast(to, title, body, type) {
      const { subject, html } = tmpl.broadcast(title, body, type);
      await send(to, subject, html);
    },
  };
}
