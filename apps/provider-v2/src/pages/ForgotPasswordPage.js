import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    async function onSubmit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
        }
        catch {
            // Always show success to avoid leaking which emails are registered.
        }
        finally {
            setSent(true);
            setBusy(false);
        }
    }
    async function onResend() {
        setBusy(true);
        try {
            await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
        }
        catch {
            /* best-effort */
        }
        setBusy(false);
    }
    if (sent) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-6", children: _jsxs("div", { className: "w-full max-w-sm text-center", children: [_jsx("div", { className: "mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-ok/10", children: _jsx(Mail, { className: "h-7 w-7 text-ok-dark" }) }), _jsx("h2", { className: "mb-2 font-serif text-3xl tracking-tightest", children: "Check your email" }), _jsxs("p", { className: "mb-6 text-sm text-muted-foreground", children: ["We've sent a password reset link to", ' ', _jsx("strong", { className: "text-foreground", children: email }), ". The link expires in 1 hour."] }), _jsxs("div", { className: "mb-6 rounded-sm border border-border/70 bg-secondary/30 p-4 text-left", children: [_jsx("div", { className: "mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Didn't receive it?" }), _jsxs("ul", { className: "space-y-1 text-xs text-muted-foreground", children: [_jsx("li", { children: "\u00B7 Check your spam or junk folder" }), _jsx("li", { children: "\u00B7 Make sure you entered the correct email" }), _jsx("li", { children: "\u00B7 Wait 2 minutes before requesting again" })] })] }), _jsx(Button, { variant: "outline", className: "w-full", onClick: onResend, disabled: busy, children: busy ? 'Sending…' : 'Resend reset link' }), _jsx("div", { className: "mt-6", children: _jsxs(Link, { to: "/login", className: "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground", children: [_jsx(ArrowLeft, { className: "h-3 w-3" }), "Back to sign in"] }) })] }) }));
    }
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-6", children: _jsxs("div", { className: "w-full max-w-sm text-center", children: [_jsx("div", { className: "mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-gold-100 text-gold-700", children: _jsx(Lock, { className: "h-7 w-7" }) }), _jsx("h2", { className: "mb-2 font-serif text-3xl tracking-tightest", children: "Reset your password" }), _jsx("p", { className: "mb-8 text-sm text-muted-foreground", children: "Enter the email associated with your provider account. We'll send a reset link that expires after 1 hour." }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-4 text-left", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Email address" }), _jsx(Input, { type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "doctor@clinic.com", required: true, autoFocus: true })] }), _jsx(Button, { type: "submit", className: "w-full", disabled: busy, children: busy ? 'Sending…' : 'Send reset link' })] }), _jsx("div", { className: "mt-6", children: _jsxs(Link, { to: "/login", className: "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground", children: [_jsx(ArrowLeft, { className: "h-3 w-3" }), "Back to sign in"] }) })] }) }));
}
