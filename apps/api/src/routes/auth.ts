import { Router } from 'express';
import type { Container } from '../config/container';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { createAuthLimiters } from '../middleware/rateLimiter';
import {
  registerPatientSchema,
  registerProviderSchema,
  verifyEmailSchema,
  loginSchema,
  mfaVerifySetupSchema,
  mfaVerifySchema,
  mfaSmsSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerifyEmailSchema,
  changePasswordSchema,
  fcmTokenSchema,
} from '@tmjconnect/shared';
import { DEVICE_INFO_MAX_LENGTH } from '../config/constants';
import * as Register from '../use-cases/auth/register';
import * as PatientInitMfa from '../use-cases/auth/patient-init-mfa';
import * as PatientDisableMfa from '../use-cases/auth/patient-disable-mfa';
import * as VerifyEmail from '../use-cases/auth/verify-email';
import * as SetupMfa from '../use-cases/auth/setup-mfa';
import * as VerifyMfaSetup from '../use-cases/auth/verify-mfa-setup';
import * as Login from '../use-cases/auth/login';
import * as VerifyMfa from '../use-cases/auth/verify-mfa';
import * as SendSmsMfa from '../use-cases/auth/send-sms-mfa';
import * as RefreshToken from '../use-cases/auth/refresh-token';
import * as ForgotPassword from '../use-cases/auth/forgot-password';
import * as ResetPassword from '../use-cases/auth/reset-password';
import * as ResendVerifyEmail from '../use-cases/auth/resend-verify-email';
import * as Logout from '../use-cases/auth/logout';
import * as LogoutAll from '../use-cases/auth/logout-all';
import * as ChangePassword from '../use-cases/auth/change-password';
import * as UpdateFcmToken from '../use-cases/auth/update-fcm-token';

function extractDeviceInfo(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['user-agent'] ?? '').toString().substring(0, DEVICE_INFO_MAX_LENGTH);
}

export function authRouter(container: Container) {
  const router = Router();
  const { loginLimiter, emailVerifyLimiter } = createAuthLimiters(container.pool);

  // ═══════════════════════════════════════════════════════════════════════════════
  // PATIENT AUTH FLOW
  // Register → verify-email → tokens
  // Login → tokens directly (or mfa_token if patient opted into MFA)
  // ═══════════════════════════════════════════════════════════════════════════════

  router.post('/patient/register', validate(registerPatientSchema), async (req, res, next) => {
    try {
      await Register.execute(container, { role: 'patient', ...req.body });
      res.status(201).json({ message: 'Check your email to verify your account.' });
    } catch (err) { next(err); }
  });

  router.post('/patient/login', validate(loginSchema), async (req, res, next) => {
    try {
      const result = await Login.execute(
        { ...container, loginLimiter },
        { role: 'patient', email: req.body.email, password: req.body.password, ip: req.ip ?? null, deviceInfo: extractDeviceInfo(req) },
      );
      if (result.type === 'tokens') {
        res.json({ access_token: result.accessToken, refresh_token: result.refreshTokenValue });
      } else {
        res.json({ mfa_required: true, mfa_token: result.mfa_token });
      }
    } catch (err) { next(err); }
  });

  // ─── Patient optional MFA (opt-in / opt-out) ──────────────────────────────────
  // Step 1: POST /patient/mfa/init → returns setup_token
  // Step 2: POST /mfa/setup (Bearer: setup_token) → returns QR + secret
  // Step 3: POST /mfa/verify-setup (Bearer: setup_token + code) → enables MFA + tokens
  // Disable: DELETE /patient/mfa (requires password confirmation)

  router.post('/patient/mfa/init', authenticate, async (req, res, next) => {
    try {
      if (req.user!.role !== 'patient') {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Use the provider MFA flow.' } });
        return;
      }
      const result = await PatientInitMfa.execute(container, { userId: req.user!.id });
      res.json(result);
    } catch (err) { next(err); }
  });

  router.delete('/patient/mfa', authenticate, auditLog('auth.mfa_disabled'), async (req, res, next) => {
    try {
      if (req.user!.role !== 'patient') {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Providers cannot disable MFA.' } });
        return;
      }
      await PatientDisableMfa.execute(container, { userId: req.user!.id, password: req.body.password });
      res.json({ message: 'MFA has been disabled.' });
    } catch (err) { next(err); }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROVIDER AUTH FLOW
  // Register → verify-email → setup_token → mfa/setup → mfa/verify-setup → tokens + backup codes
  // Login → mfa_token → mfa/verify → tokens
  // ═══════════════════════════════════════════════════════════════════════════════

  router.post('/provider/register', validate(registerProviderSchema), async (req, res, next) => {
    try {
      await Register.execute(container, { role: 'provider', ...req.body });
      res.status(201).json({ message: 'Check your email to verify your account.' });
    } catch (err) { next(err); }
  });

  router.post('/provider/login', validate(loginSchema), async (req, res, next) => {
    try {
      const result = await Login.execute(
        { ...container, loginLimiter },
        { role: 'provider', email: req.body.email, password: req.body.password, ip: req.ip ?? null, deviceInfo: extractDeviceInfo(req) },
      );
      if (result.type !== 'mfa_required') {
        res.status(500).json({ error: { code: 'INTERNAL', message: 'Unexpected login result.' } });
        return;
      }
      res.json({ mfa_required: true, mfa_token: result.mfa_token });
    } catch (err) { next(err); }
  });

  // ─── MFA setup (provider onboarding, after verify-email) ─────────────────────
  router.post('/mfa/setup', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const setupToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!setupToken) { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Setup token required.' } }); return; }
      res.json(await SetupMfa.execute(container, { setupToken }));
    } catch (err) { next(err); }
  });

  router.post('/mfa/verify-setup', validate(mfaVerifySetupSchema), async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const setupToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!setupToken) { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Setup token required.' } }); return; }
      const result = await VerifyMfaSetup.execute(container, { setupToken, code: req.body.code });
      res.json({
        message: 'MFA setup complete. Save these backup codes — they will not be shown again.',
        backup_codes: result.backup_codes,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
    } catch (err) { next(err); }
  });

  // ─── MFA verify (provider login continuation) ────────────────────────────────
  router.post('/mfa/verify', validate(mfaVerifySchema), auditLog('auth.mfa_verify'), async (req, res, next) => {
    try {
      const tokens = await VerifyMfa.execute(container, {
        mfa_token: req.body.mfa_token,
        code: req.body.code,
        type: req.body.type,
        ip: req.ip ?? null,
        deviceInfo: extractDeviceInfo(req),
      });
      res.json({ access_token: tokens.accessToken, refresh_token: tokens.refreshTokenValue });
    } catch (err) { next(err); }
  });

  router.post('/mfa/sms', validate(mfaSmsSchema), async (req, res, next) => {
    try {
      await SendSmsMfa.execute(container, { mfa_token: req.body.mfa_token });
      res.json({ message: 'Verification code sent via SMS.' });
    } catch (err) { next(err); }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SHARED ENDPOINTS (both roles)
  // ═══════════════════════════════════════════════════════════════════════════════

  router.post('/verify-email', validate(verifyEmailSchema), auditLog('auth.verify_email'), async (req, res, next) => {
    try {
      const result = await VerifyEmail.execute({ ...container, emailVerifyLimiter }, req.body);
      if (result.type === 'tokens') {
        res.json({ access_token: result.accessToken, refresh_token: result.refreshTokenValue });
      } else {
        res.json({ mfa_setup_required: true, setup_token: result.setup_token });
      }
    } catch (err) { next(err); }
  });

  router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
    try {
      const tokens = await RefreshToken.execute(container, {
        tokenValue: req.body.refresh_token,
        deviceInfo: extractDeviceInfo(req),
        ip: req.ip ?? null,
      });
      res.json({ access_token: tokens.accessToken, refresh_token: tokens.refreshTokenValue });
    } catch (err) { next(err); }
  });

  router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res, next) => {
    try {
      await ForgotPassword.execute(container, { email: req.body.email });
      res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (err) { next(err); }
  });

  router.post('/reset-password', validate(resetPasswordSchema), auditLog('auth.password_reset'), async (req, res, next) => {
    try {
      await ResetPassword.execute(container, { token: req.body.token, new_password: req.body.new_password });
      res.json({ message: 'Password reset successfully. Please log in with your new password.' });
    } catch (err) { next(err); }
  });

  router.post('/resend-verify-email', validate(resendVerifyEmailSchema), async (req, res, next) => {
    try {
      await ResendVerifyEmail.execute(container, { email: req.body.email });
      res.json({ message: 'If that email is unverified, a new code has been sent.' });
    } catch (err) { next(err); }
  });

  router.delete('/logout', authenticate, auditLog('auth.logout'), async (req, res, next) => {
    try {
      await Logout.execute(container, { tokenValue: req.body?.refresh_token });
      res.json({ message: 'Logged out successfully.' });
    } catch (err) { next(err); }
  });

  router.delete('/logout-all', authenticate, auditLog('auth.logout_all'), async (req, res, next) => {
    try {
      await LogoutAll.execute(container, { userId: req.user!.id });
      res.json({ message: 'Logged out from all devices.' });
    } catch (err) { next(err); }
  });

  router.patch('/change-password', authenticate, validate(changePasswordSchema), auditLog('auth.change_password'), async (req, res, next) => {
    try {
      await ChangePassword.execute(container, {
        userId: req.user!.id,
        currentPassword: req.body.current_password,
        newPassword: req.body.new_password,
      });
      res.json({ message: 'Password changed successfully.' });
    } catch (err) { next(err); }
  });

  router.patch('/fcm-token', authenticate, validate(fcmTokenSchema), async (req, res, next) => {
    try {
      await UpdateFcmToken.execute(container, { userId: req.user!.id, fcmToken: req.body.fcm_token });
      res.json({ message: 'FCM token updated.' });
    } catch (err) { next(err); }
  });

  return router;
}
