import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Copy, Key, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiFetch, setAccessToken } from '@/lib/api';
const REFRESH_KEY = 'tmjc.refresh';
export function VerifyAndSetupPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const emailFromQuery = params.get('email') ?? '';
    const [step, setStep] = useState('verify-email');
    const [email, setEmail] = useState(emailFromQuery);
    const [code, setCode] = useState('');
    const [setupToken, setSetupToken] = useState(null);
    const [qrUri, setQrUri] = useState(null);
    const [mfaSecret, setMfaSecret] = useState(null);
    const [mfaCode, setMfaCode] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    async function onVerifyEmail(e) {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const res = await apiFetch('/auth/verify-email', { method: 'POST', body: { email, code } });
            if (res.setup_token) {
                setSetupToken(res.setup_token);
                const mfa = await apiFetch('/auth/mfa/setup', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${res.setup_token}` },
                });
                setMfaSecret(mfa.secret);
                setQrUri(mfa.qr_uri);
                setStep('mfa-setup');
            }
            else if (res.access_token) {
                localStorage.setItem(REFRESH_KEY, res.refresh_token);
                setAccessToken(res.access_token);
                navigate('/onboarding', { replace: true });
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed');
        }
        finally {
            setBusy(false);
        }
    }
    async function onVerifyMfa(e) {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const res = await apiFetch('/auth/mfa/verify-setup', {
                method: 'POST',
                headers: { Authorization: `Bearer ${setupToken}` },
                body: { code: mfaCode },
            });
            setBackupCodes(res.backup_codes);
            localStorage.setItem(REFRESH_KEY, res.refresh_token);
            setAccessToken(res.access_token);
            setStep('backup-codes');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'MFA verification failed');
        }
        finally {
            setBusy(false);
        }
    }
    async function onResend() {
        setError(null);
        try {
            await apiFetch('/auth/resend-verify-email', { method: 'POST', body: { email } });
            setResendCooldown(60);
            const interval = setInterval(() => {
                setResendCooldown((c) => {
                    if (c <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return c - 1;
                });
            }, 1000);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Resend failed');
        }
    }
    function copyBackupCodes() {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    const steps = [
        { key: 'verify-email', label: 'Email' },
        { key: 'mfa-setup', label: 'MFA setup' },
        { key: 'mfa-verify', label: 'Verify' },
        { key: 'backup-codes', label: 'Backup' },
    ];
    const currentIdx = steps.findIndex((s) => s.key === step);
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-6 py-16", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsx("div", { className: "mb-10 grid grid-cols-4 gap-2", children: steps.map((s, i) => (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("div", { className: cn('h-1 rounded-sm transition-colors', i <= currentIdx ? 'bg-gold-600' : 'bg-secondary') }), _jsx("div", { className: cn('font-mono text-[10px] uppercase tracking-[0.18em]', i === currentIdx
                                    ? 'text-foreground'
                                    : i < currentIdx
                                        ? 'text-muted-foreground'
                                        : 'text-muted-foreground/50'), children: s.label })] }, s.key))) }), step === 'verify-email' && (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-navy-100 text-navy-700", children: _jsx(Mail, { className: "h-7 w-7" }) }), _jsx("h2", { className: "mb-2 font-serif text-3xl tracking-tightest", children: "Verify your email" }), _jsxs("p", { className: "mb-8 text-sm text-muted-foreground", children: ["We sent a 6-digit code to", ' ', _jsx("strong", { className: "text-foreground", children: email || 'your email' })] }), _jsxs("form", { onSubmit: onVerifyEmail, className: "space-y-5 text-left", children: [!emailFromQuery && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Email" }), _jsx(Input, { type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, placeholder: "doctor@clinic.com" })] })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Verification code" }), _jsx(DigitsInput, { value: code, onChange: setCode })] }), error && (_jsx("div", { className: "rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive", children: error })), _jsx(Button, { type: "submit", className: "w-full", disabled: busy || code.length !== 6, children: busy ? 'Verifying…' : 'Verify email' })] }), _jsx("div", { className: "mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: resendCooldown > 0 ? (_jsxs("span", { children: ["Resend in ", _jsxs("strong", { className: "text-gold-700", children: [resendCooldown, "s"] })] })) : (_jsx("button", { onClick: onResend, className: "hover:text-foreground", children: "Resend code" })) })] })), step === 'mfa-setup' && (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-gold-100 text-gold-700", children: _jsx(ShieldCheck, { className: "h-7 w-7" }) }), _jsx("h2", { className: "mb-2 font-serif text-3xl tracking-tightest", children: "Set up two-factor auth" }), _jsx("p", { className: "mb-6 text-sm text-muted-foreground", children: "MFA is mandatory for provider accounts. Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password)." }), qrUri && (_jsx("div", { className: "mb-6 rounded-sm border border-border/70 bg-white p-6", children: _jsx("img", { src: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`, alt: "MFA QR code", className: "mx-auto h-48 w-48" }) })), mfaSecret && (_jsxs("div", { className: "mb-6 rounded-sm border border-border/70 bg-secondary/40 p-3", children: [_jsx("p", { className: "mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Manual entry key" }), _jsx("p", { className: "select-all font-mono text-sm tracking-wider text-foreground", children: mfaSecret })] })), _jsx(Button, { className: "w-full", onClick: () => setStep('mfa-verify'), children: "I've scanned the code" }), _jsxs("div", { className: "mt-4 flex items-start gap-3 rounded-sm border border-gold-600/30 bg-gold-100/40 p-3 text-left", children: [_jsx(ShieldCheck, { className: "mt-0.5 h-4 w-4 shrink-0 text-gold-700" }), _jsxs("p", { className: "text-xs leading-relaxed text-muted-foreground", children: [_jsx("strong", { className: "text-foreground", children: "HIPAA requirement." }), " MFA cannot be disabled for provider accounts."] })] })] })), step === 'mfa-verify' && (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-navy-100 text-navy-700", children: _jsx(Smartphone, { className: "h-7 w-7" }) }), _jsx("h2", { className: "mb-2 font-serif text-3xl tracking-tightest", children: "Enter your code" }), _jsx("p", { className: "mb-8 text-sm text-muted-foreground", children: "Open your authenticator app and enter the 6-digit code shown." }), _jsxs("form", { onSubmit: onVerifyMfa, className: "space-y-5", children: [_jsx(DigitsInput, { value: mfaCode, onChange: setMfaCode }), error && (_jsx("div", { className: "rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive", children: error })), _jsx(Button, { type: "submit", className: "w-full", disabled: busy || mfaCode.length !== 6, children: busy ? 'Verifying…' : 'Verify & activate MFA' })] }), _jsx("button", { onClick: () => setStep('mfa-setup'), className: "mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground", children: "Back to QR code" })] })), step === 'backup-codes' && (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-ok/10 text-ok-dark", children: _jsx(Key, { className: "h-7 w-7" }) }), _jsx("h2", { className: "mb-2 font-serif text-3xl tracking-tightest", children: "Save your backup codes" }), _jsxs("p", { className: "mb-6 text-sm text-muted-foreground", children: ["These codes can be used if you lose your authenticator.", ' ', _jsx("strong", { className: "text-foreground", children: "They will not be shown again." })] }), _jsxs("div", { className: "mb-6 rounded-sm border border-border/70 bg-secondary/30 p-5", children: [_jsx("div", { className: "grid grid-cols-2 gap-2", children: backupCodes.map((c) => (_jsx("div", { className: "select-all rounded-sm bg-card px-3 py-2 font-mono text-sm tracking-wider", children: c }, c))) }), _jsx(Button, { variant: "outline", size: "sm", className: "mt-4 w-full", onClick: copyBackupCodes, children: copied ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "mr-1.5 h-3.5 w-3.5" }), " Copied"] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { className: "mr-1.5 h-3.5 w-3.5" }), " Copy all codes"] })) })] }), _jsx(Button, { className: "w-full", onClick: () => navigate('/onboarding', { replace: true }), children: "Continue to dashboard" })] }))] }) }));
}
function DigitsInput({ value, onChange }) {
    const refs = useRef([]);
    const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
    useEffect(() => {
        refs.current[0]?.focus();
    }, []);
    function setDigit(i, char) {
        const cleaned = char.replace(/\D/g, '').slice(-1);
        const next = digits.slice();
        next[i] = cleaned;
        const joined = next.join('').slice(0, 6);
        onChange(joined);
        if (cleaned && i < 5)
            refs.current[i + 1]?.focus();
    }
    function onKeyDown(i, e) {
        if (e.key === 'Backspace' && !digits[i] && i > 0)
            refs.current[i - 1]?.focus();
        if (e.key === 'ArrowLeft' && i > 0)
            refs.current[i - 1]?.focus();
        if (e.key === 'ArrowRight' && i < 5)
            refs.current[i + 1]?.focus();
    }
    function onPaste(e) {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted)
            return;
        e.preventDefault();
        onChange(pasted);
        refs.current[Math.min(pasted.length, 5)]?.focus();
    }
    return (_jsx("div", { className: "flex gap-2", children: digits.map((d, i) => (_jsx("input", { ref: (el) => {
                refs.current[i] = el;
            }, type: "text", inputMode: "numeric", autoComplete: i === 0 ? 'one-time-code' : 'off', value: d, onChange: (e) => setDigit(i, e.target.value), onKeyDown: (e) => onKeyDown(i, e), onPaste: onPaste, maxLength: 1, className: "h-12 w-full rounded-sm border border-border bg-card text-center font-mono text-xl tracking-tightest text-foreground transition-colors focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/20", "aria-label": `Digit ${i + 1}` }, i))) }));
}
