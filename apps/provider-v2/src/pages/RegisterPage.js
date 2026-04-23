import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
const PW_RULES = [
    { label: '8+ characters', test: (p) => p.length >= 8 },
    { label: '1 number', test: (p) => /\d/.test(p) },
    { label: '1 special character', test: (p) => /[!@#$%^&*]/.test(p) },
    { label: 'Passwords match', test: (p, c) => c.length > 0 && p === c },
];
const VALUE_PROPS = [
    'Free during pilot programme',
    'No app installation — runs in your browser',
    'Set up in under 5 minutes',
    'HIPAA-compliant with mandatory MFA',
];
export function RegisterPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        specialty: '',
        license_number: '',
        license_type: '',
        clinic_name: '',
        password: '',
        confirm_password: '',
    });
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [agreed, setAgreed] = useState(false);
    function set(k, v) {
        setForm((f) => ({ ...f, [k]: v }));
    }
    async function onSubmit(e) {
        e.preventDefault();
        if (form.password !== form.confirm_password) {
            setError('Passwords do not match');
            return;
        }
        if (!agreed) {
            setError('You must agree to the Terms of Service');
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            await apiFetch('/auth/provider/register', {
                method: 'POST',
                body: {
                    first_name: form.first_name,
                    last_name: form.last_name,
                    email: form.email,
                    phone: form.phone,
                    date_of_birth: form.date_of_birth,
                    specialty: form.specialty,
                    license_number: form.license_number,
                    license_type: form.license_type,
                    clinic_name: form.clinic_name,
                    password: form.password,
                },
            });
            navigate(`/verify?email=${encodeURIComponent(form.email)}`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs("div", { className: "relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]", children: [_jsxs("aside", { className: "grain relative hidden overflow-hidden bg-navy-700 text-background lg:flex lg:flex-col lg:justify-between lg:p-12", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-sm bg-gold-600 text-navy-900", children: _jsx("span", { className: "font-serif text-lg italic leading-none", children: "t" }) }), _jsxs("div", { className: "flex flex-col leading-tight", children: [_jsx("span", { className: "font-serif text-base tracking-tightest", children: "TMJConnect" }), _jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] opacity-60", children: "Provider Portal" })] })] }), _jsxs("div", { className: "relative z-10 max-w-lg", children: [_jsx("div", { className: "mb-8 font-mono text-[10px] uppercase tracking-[0.3em] opacity-60", children: "Built for specialists. Trusted by clinics." }), _jsxs("h1", { className: "font-serif text-[48px] font-normal leading-[1.02] tracking-tightest", children: ["Start managing your patients", ' ', _jsx("em", { className: "text-gold-400", children: "between visits." })] }), _jsx("div", { className: "mt-10 space-y-4", children: VALUE_PROPS.map((text) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-7 w-7 items-center justify-center rounded-sm bg-gold-600/15", children: _jsx(Check, { className: "h-3.5 w-3.5 text-gold-400" }) }), _jsx("span", { className: "text-sm opacity-80", children: text })] }, text))) })] }), _jsx("div", { className: "relative z-10 font-mono text-[10px] uppercase tracking-[0.22em] opacity-50", children: "AQION \u00D7 Orofacial \u00B7 HIPAA \u00B7 SOC 2" })] }), _jsx("section", { className: "flex items-start justify-center overflow-y-auto px-6 py-10", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "mb-8 flex items-center gap-3 lg:hidden", children: [_jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-sm bg-navy-600 text-gold-400", children: _jsx("span", { className: "font-serif text-base italic leading-none", children: "t" }) }), _jsx("span", { className: "font-serif text-[15px] tracking-tightest", children: "TMJConnect" })] }), _jsxs("div", { className: "mb-8", children: [_jsx(Badge, { variant: "muted", size: "md", className: "mb-3", children: "Create account" }), _jsxs("h2", { className: "font-serif text-3xl tracking-tightest", children: ["Create your ", _jsx("em", { className: "text-gold-700", children: "account." })] }), _jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "All fields marked with * are required." })] }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-6", children: [_jsxs(Section, { label: "Personal information", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Field, { label: "First name *", children: _jsx(Input, { required: true, value: form.first_name, onChange: (e) => set('first_name', e.target.value) }) }), _jsx(Field, { label: "Last name *", children: _jsx(Input, { required: true, value: form.last_name, onChange: (e) => set('last_name', e.target.value) }) })] }), _jsx(Field, { label: "Email *", children: _jsx(Input, { type: "email", required: true, value: form.email, onChange: (e) => set('email', e.target.value), placeholder: "doctor@clinic.com" }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Field, { label: "Phone * (E.164)", children: _jsx(Input, { type: "tel", required: true, value: form.phone, onChange: (e) => set('phone', e.target.value), placeholder: "+15551234567" }) }), _jsx(Field, { label: "Date of birth *", children: _jsx(Input, { type: "date", required: true, value: form.date_of_birth, onChange: (e) => set('date_of_birth', e.target.value) }) })] })] }), _jsxs(Section, { label: "Professional credentials", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Field, { label: "Specialty *", children: _jsx(Input, { required: true, value: form.specialty, onChange: (e) => set('specialty', e.target.value), placeholder: "Orofacial Pain" }) }), _jsx(Field, { label: "License type *", children: _jsx(Input, { required: true, value: form.license_type, onChange: (e) => set('license_type', e.target.value), placeholder: "DDS, DMD, PT" }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Field, { label: "License number *", children: _jsx(Input, { required: true, value: form.license_number, onChange: (e) => set('license_number', e.target.value) }) }), _jsx(Field, { label: "Clinic name *", children: _jsx(Input, { required: true, value: form.clinic_name, onChange: (e) => set('clinic_name', e.target.value) }) })] })] }), _jsxs(Section, { label: "Security", children: [_jsx(Field, { label: "Password *", children: _jsx(Input, { type: "password", required: true, value: form.password, onChange: (e) => set('password', e.target.value) }) }), _jsx("ul", { className: "grid grid-cols-2 gap-x-4 gap-y-1.5", children: PW_RULES.map((rule) => {
                                                const met = rule.test(form.password, form.confirm_password);
                                                return (_jsxs("li", { className: cn('flex items-center gap-2 text-[11px] transition-colors', met ? 'text-ok-dark' : 'text-muted-foreground'), children: [_jsx("span", { className: cn('flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-colors', met ? 'border-ok bg-ok' : 'border-border'), children: met && _jsx(Check, { className: "h-2 w-2 text-background" }) }), rule.label] }, rule.label));
                                            }) }), _jsx(Field, { label: "Confirm password *", children: _jsx(Input, { type: "password", required: true, value: form.confirm_password, onChange: (e) => set('confirm_password', e.target.value) }) })] }), _jsxs("div", { className: "flex items-start gap-3 rounded-sm border border-gold-600/30 bg-gold-100/40 p-3", children: [_jsx(ShieldCheck, { className: "mt-0.5 h-4 w-4 shrink-0 text-gold-700" }), _jsxs("p", { className: "text-xs leading-relaxed text-muted-foreground", children: ["Provider accounts require ", _jsx("strong", { className: "text-foreground", children: "multi-factor authentication" }), ". You'll set up an authenticator app after verifying your email."] })] }), _jsxs("label", { className: "flex cursor-pointer items-start gap-3", children: [_jsx("input", { type: "checkbox", checked: agreed, onChange: (e) => setAgreed(e.target.checked), className: "mt-1 h-3.5 w-3.5 rounded-sm border-border accent-navy-600" }), _jsxs("span", { className: "text-xs leading-relaxed text-muted-foreground", children: ["I agree to the", ' ', _jsx(Link, { to: "/terms", className: "font-semibold text-foreground underline-offset-2 hover:underline", children: "Terms of Service" }), ' ', "and", ' ', _jsx(Link, { to: "/privacy", className: "font-semibold text-foreground underline-offset-2 hover:underline", children: "Privacy Policy" })] })] }), error && (_jsx("div", { className: "rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive", children: error })), _jsx(Button, { type: "submit", className: "w-full", disabled: submitting, children: submitting ? 'Creating account…' : 'Create provider account' })] }), _jsxs("p", { className: "mt-6 text-center text-sm text-muted-foreground", children: ["Already have an account?", ' ', _jsx(Link, { to: "/login", className: "font-semibold text-foreground hover:underline", children: "Sign in" })] })] }) })] }));
}
function Section({ label, children }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: label }), _jsx("div", { className: "space-y-3", children: children })] }));
}
function Field({ label, children }) {
    return (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: label }), children] }));
}
