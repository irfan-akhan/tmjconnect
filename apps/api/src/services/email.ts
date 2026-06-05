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
  sendLinkAccepted(to: string, providerName: string, patientName: string): Promise<void>;
  sendReportSubmitted(to: string, providerName: string, patientName: string, urgency: string): Promise<void>;
  sendReportReviewed(to: string, patientName: string): Promise<void>;
  sendWeeklyDigest(to: string, patientName: string, stats: WeeklyDigestStats): Promise<void>;
  sendEmailInvite(to: string, providerName: string, code: string): Promise<void>;
  sendEmailChangeCode(to: string, code: string): Promise<void>;
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
                <a href="#" style="color:#888;">Unsubscribe</a> &middot;
                <a href="#" style="color:#888;">Support</a>
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
  return `<a href="${href}" style="display:inline-block;background:${BRAND_GOLD};color:#fff;font-weight:bold;padding:12px 24px;border-radius:4px;text-decoration:none;margin:16px 0;">${text}</a>`;
}

// ─── Email templates ──────────────────────────────────────────────────────────────

function templates(appUrl: string) {
  return {
    verifyEmail: (code: string) => ({
      subject: 'Verify your TMJConnect email address',
      html: baseTemplate(`
        <h2 style="color:${BRAND_NAVY};">Verify your email</h2>
        <p>Enter this 6-digit code to verify your TMJConnect account:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND_NAVY};text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
          ${code}
        </div>
        <p style="color:#888;font-size:13px;">This code expires in 24 hours. If you did not create a TMJConnect account, you can safely ignore this email.</p>
      `),
    }),

    emailChangeCode: (code: string) => ({
      subject: 'Confirm your new TMJConnect email',
      html: baseTemplate(`
        <h2 style="color:${BRAND_NAVY};">Confirm your new email</h2>
        <p>Enter this 6-digit code in TMJConnect to finish switching your sign-in email to this address:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND_NAVY};text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
          ${code}
        </div>
        <p style="color:#888;font-size:13px;">This code expires in 1 hour. If you didn't request an email change, you can safely ignore this — your current email stays active.</p>
      `),
    }),

    welcome: (firstName: string) => {
      const name = escHtml(firstName);
      return {
        subject: 'Welcome to TMJConnect',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Welcome, ${name}!</h2>
          <p>Your TMJConnect account is ready. You can now log in to track your symptoms and connect with your care team.</p>
          ${ctaButton(`${appUrl}/login`, 'Open TMJConnect')}
        `),
      };
    },

    passwordReset: (resetUrl: string) => ({
      subject: 'Reset your TMJConnect password',
      html: baseTemplate(`
        <h2 style="color:${BRAND_NAVY};">Reset your password</h2>
        <p>Click the button below to reset your TMJConnect password. This link expires in 1 hour.</p>
        ${ctaButton(resetUrl, 'Reset Password')}
        <p style="color:#888;font-size:13px;">If you did not request a password reset, you can safely ignore this email.</p>
      `),
    }),

    passwordResetCode: (code: string) => ({
      subject: 'Your TMJConnect password reset code',
      html: baseTemplate(`
        <h2 style="color:${BRAND_NAVY};">Reset your password</h2>
        <p>Enter this 6-digit code in TMJConnect to continue resetting your password:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND_NAVY};text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
          ${code}
        </div>
        <p style="color:#888;font-size:13px;">This code expires in 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
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
          <p>Hi ${name}, we noticed a login to your TMJConnect account from a new device.</p>
          <table style="background:#f5f5f5;padding:16px;border-radius:4px;width:100%;">
            <tr><td><strong>IP Address:</strong></td><td>${safeIp}</td></tr>
            <tr><td><strong>Device:</strong></td><td>${safeDevice}</td></tr>
          </table>
          <p>If this was you, no action is needed. If you don't recognize this, change your password immediately.</p>
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
          <p>Hi ${name}, your TMJConnect account has been locked after 5 failed login attempts.</p>
          <p>Your account will unlock automatically in 30 minutes. If you forgot your password, you can reset it now.</p>
          ${ctaButton(`${appUrl}/forgot-password`, 'Reset Password')}
        `),
      };
    },

    linkAccepted: (providerName: string, patientName: string) => {
      const provider = escHtml(providerName);
      const patient = escHtml(patientName);
      return {
        subject: `${patientName} has accepted your TMJConnect invitation`,
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Patient connected</h2>
          <p>Hi ${provider}, <strong>${patient}</strong> has accepted your invitation and is now connected to your TMJConnect portal.</p>
          ${ctaButton(`${appUrl}/portal/patients`, 'View Patient Dashboard')}
        `),
      };
    },

    reportSubmitted: (providerName: string, patientName: string, urgency: string) => {
      const provider = escHtml(providerName);
      const patient = escHtml(patientName);
      const safeUrgency = escHtml(urgency);
      return {
        subject: `${urgency === 'urgent' ? '🚨 URGENT: ' : ''}New report from ${patientName}`,
        html: baseTemplate(`
          <h2 style="color:${urgency === 'urgent' ? '#c0392b' : BRAND_NAVY};">
            New ${safeUrgency} report
          </h2>
          <p>Hi ${provider}, <strong>${patient}</strong> has submitted a new ${safeUrgency} health report.</p>
          ${ctaButton(`${appUrl}/portal/reports`, 'View Report')}
        `),
      };
    },

    reportReviewed: (patientName: string) => {
      const patient = escHtml(patientName);
      return {
        subject: 'Your TMJConnect report has been reviewed',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Report reviewed</h2>
          <p>Hi ${patient}, your provider has reviewed your recent health report.</p>
          ${ctaButton(`${appUrl}/reports`, 'View Report')}
        `),
      };
    },

    weeklyDigest: (patientName: string, stats: WeeklyDigestStats) => {
      const patient = escHtml(patientName);
      return {
        subject: 'Your TMJConnect weekly summary',
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">Weekly summary for ${patient}</h2>
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
        subject: `${providerName} has invited you to TMJConnect`,
        html: baseTemplate(`
          <h2 style="color:${BRAND_NAVY};">You've been invited to TMJConnect</h2>
          <p>Your healthcare provider <strong>${provider}</strong> has invited you to join TMJConnect to manage your care.</p>
          <p>Download the app and use this code to connect:</p>
          <div style="font-size:28px;font-weight:bold;letter-spacing:6px;color:${BRAND_NAVY};text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
            ${code}
          </div>
          <p style="color:#888;font-size:13px;">This code expires in 7 days.</p>
        `),
      };
    },

    broadcast: (title: string, body: string, type: 'announcement' | 'system') => {
      const safeTitle = escHtml(title);
      const safeBody = escHtml(body).replace(/\n/g, '<br>');
      const headingColor = type === 'system' ? '#c0392b' : BRAND_NAVY;
      return {
        subject: title,
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
    if (!sgMail) {
      if (isProduction) throw new Error('Email service not configured: SENDGRID_API_KEY missing.');
      logger.info({ to, subject }, '[EmailService stub] Email would be sent');
      return;
    }

    await breaker.execute(async () => {
      try {
        await sgMail!.send({ from: fromAddress, to, subject, html });
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
    async sendLinkAccepted(to, providerName, patientName) {
      const { subject, html } = tmpl.linkAccepted(providerName, patientName);
      await send(to, subject, html);
    },
    async sendReportSubmitted(to, providerName, patientName, urgency) {
      const { subject, html } = tmpl.reportSubmitted(providerName, patientName, urgency);
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
    async sendBroadcast(to, title, body, type) {
      const { subject, html } = tmpl.broadcast(title, body, type);
      await send(to, subject, html);
    },
  };
}
