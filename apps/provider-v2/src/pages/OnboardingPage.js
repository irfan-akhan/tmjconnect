import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Bell, ChevronRight, MessageSquare, Shield, Users, Video, } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const STEPS = [
    {
        badge: 'Step 1 of 4',
        title: 'Welcome to TMJConnect.',
        desc: "You're all set up. Let's take a quick tour of your provider workspace — it only takes 60 seconds.",
        cards: null,
    },
    {
        badge: 'Step 2 of 4',
        title: "Here's what you can do.",
        desc: 'Your provider portal gives you everything you need to manage patients between clinic visits — all from your browser.',
        cards: [
            {
                icon: Users,
                label: 'Patient dashboard',
                desc: 'See all patients at a glance with real-time pain trends and adherence rates.',
                accent: 'navy',
            },
            {
                icon: Video,
                label: 'Exercise videos',
                desc: 'Upload videos and assign them with frequency and reminders.',
                accent: 'gold',
            },
            {
                icon: MessageSquare,
                label: 'Patient reports',
                desc: 'Receive urgent reports instantly. Respond with templates or custom messages.',
                accent: 'urgent',
            },
        ],
    },
    {
        badge: 'Step 3 of 4',
        title: 'Insights at your fingertips.',
        desc: 'Track cross-patient analytics, exercise compliance, and pain trends — all in one dashboard.',
        cards: [
            {
                icon: BarChart3,
                label: 'Practice analytics',
                desc: 'Pain trends, trigger patterns, and engagement metrics across your roster.',
                accent: 'navy',
            },
            {
                icon: Shield,
                label: 'HIPAA compliant',
                desc: 'End-to-end encryption, 15-minute session timeout, audit trails on every action.',
                accent: 'ok',
            },
            {
                icon: Bell,
                label: 'Smart alerts',
                desc: 'Instant notifications for urgent reports, inactivity, and new connections.',
                accent: 'gold',
            },
        ],
    },
    {
        badge: 'Step 4 of 4',
        title: 'Invite your first patient.',
        desc: "Generate a 6-character invite code and share it with your patient. They'll enter it in their mobile app to connect with you.",
        cards: null,
    },
];
const ACCENT_CLASSES = {
    navy: 'bg-navy-600/10 text-navy-700',
    gold: 'bg-gold-600/15 text-gold-700',
    urgent: 'bg-err/10 text-err-dark',
    ok: 'bg-ok/10 text-ok-dark',
};
export function OnboardingPage() {
    const [step, setStep] = useState(0);
    const navigate = useNavigate();
    const current = STEPS[step];
    function next() {
        if (step < STEPS.length - 1)
            setStep(step + 1);
        else
            navigate('/dashboard', { replace: true });
    }
    function skip() {
        navigate('/dashboard', { replace: true });
    }
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-6 py-16", children: _jsxs("div", { className: "flex w-full max-w-2xl flex-col items-center text-center", children: [_jsx("div", { className: "mb-10 flex gap-2", children: STEPS.map((_, i) => (_jsx("div", { className: cn('h-1.5 w-8 rounded-sm transition-colors', i === step ? 'bg-gold-600' : i < step ? 'bg-navy-600/40' : 'bg-secondary') }, i))) }), _jsx(Badge, { variant: "muted", size: "md", className: "mb-4", children: current.badge }), _jsx("h1", { className: "mb-4 font-serif text-4xl tracking-tightest", children: current.title }), _jsx("p", { className: "mb-10 max-w-lg text-sm leading-relaxed text-muted-foreground", children: current.desc }), current.cards && (_jsx("div", { className: "mb-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-3", children: current.cards.map((card) => (_jsxs("div", { className: "rounded-sm border border-border/70 bg-card p-5 text-left shadow-navy-xs", children: [_jsx("div", { className: cn('mb-3 flex h-10 w-10 items-center justify-center rounded-sm', ACCENT_CLASSES[card.accent]), children: _jsx(card.icon, { className: "h-5 w-5" }) }), _jsx("div", { className: "mb-1 font-serif text-base tracking-tightest text-foreground", children: card.label }), _jsx("p", { className: "text-xs leading-relaxed text-muted-foreground", children: card.desc })] }, card.label))) })), step === STEPS.length - 1 && (_jsxs("div", { className: "mb-10 w-full max-w-sm rounded-sm border border-dashed border-gold-600/40 bg-gold-100/30 p-6", children: [_jsx("div", { className: "mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Quick start" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Head to ", _jsx("strong", { className: "text-foreground", children: "Invite & Link" }), ' ', "in the sidebar to generate your first invite code, or explore the dashboard first."] })] })), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: skip, className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground", children: "Skip tour" }), _jsx(Button, { onClick: next, className: "gap-2", children: step === STEPS.length - 1 ? (_jsxs(_Fragment, { children: ["Go to dashboard", _jsx(ArrowRight, { className: "h-4 w-4" })] })) : (_jsxs(_Fragment, { children: ["Continue", _jsx(ChevronRight, { className: "h-4 w-4" })] })) })] })] }) }));
}
