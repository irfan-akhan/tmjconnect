import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Activity, ArrowRight, Book, ChevronDown, CircleDot, HelpCircle, Mail, MessageCircle, PlayCircle, Search, Send, Stethoscope, } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
const FAQS = [
    {
        q: 'How do I invite a new patient to the platform?',
        a: 'Go to Invite & Link and click "Generate invite code". You\'ll get a 6-character code that expires in 7 days. You can read it to your patient in clinic or email it directly from the same modal. Once the patient enters the code in their app and accepts, they appear in your Active patients list automatically. No PHI is exchanged until both sides consent.',
        cta: 'Read full guide',
    },
    {
        q: 'Why can\'t I reply to a patient\'s report in under 15 words?',
        a: 'Provider responses default to a clinical-tone validator that flags terse replies, since they\'re a common source of patient confusion. You can override the warning if your reply is intentionally brief — e.g. "Acknowledged. Continuing current plan."',
    },
    {
        q: 'How do I reset my MFA if I lost my authenticator device?',
        a: 'Use one of your backup codes at the verify-MFA step. If you\'ve also lost those, contact providers@tmjconnect.com from the email on file and we\'ll verify you over a video call before resetting your MFA.',
    },
    {
        q: 'Can I record and upload my own exercise videos?',
        a: 'Yes — go to Exercise Library and click "Upload new video". MP4 or MOV up to 500 MB, 1080p recommended. Videos are auto-transcoded to HLS for adaptive playback in the patient app.',
    },
    {
        q: 'What counts as an urgent report? Can I customize the threshold?',
        a: 'A report is flagged urgent automatically when pain ≥ 7 or when the patient explicitly marks it urgent. Threshold customization is on the roadmap — for now the threshold is fixed at the clinical-default 7/10.',
    },
    {
        q: 'How is patient data stored? Is TMJConnect HIPAA-compliant?',
        a: 'All PHI is encrypted at rest (AES-256) and in transit (TLS 1.2+). We sign a Business Associate Agreement with every provider account. Provider session timeout is 15 minutes, and every PHI-touching request is audit-logged for 6 years per HIPAA retention rules.',
    },
];
const CATEGORIES = [
    { value: 'technical', label: 'Technical issue' },
    { value: 'billing', label: 'Billing & plan' },
    { value: 'clinical', label: 'Clinical content' },
    { value: 'feature', label: 'Feature request' },
    { value: 'other', label: 'Other' },
];
export function HelpPage() {
    const { user } = useAuth();
    const [openFaq, setOpenFaq] = useState(0);
    const [search, setSearch] = useState('');
    const firstName = user?.firstName ?? 'Provider';
    const filteredFaqs = search
        ? FAQS.filter((f) => f.q.toLowerCase().includes(search.toLowerCase()) ||
            f.a.toLowerCase().includes(search.toLowerCase()))
        : FAQS;
    return (_jsxs("div", { className: "mx-auto max-w-6xl space-y-8", children: [_jsx("section", { className: "grain relative overflow-hidden rounded-sm bg-gradient-to-br from-navy-700 to-navy-900 p-8 text-background sm:p-12", children: _jsxs("div", { className: "relative z-10 mx-auto max-w-3xl", children: [_jsx("div", { className: "mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-400/80", children: "Help center" }), _jsxs("h1", { className: "font-serif text-3xl leading-tight tracking-tightest sm:text-4xl", children: ["How can we help today, Dr. ", firstName, "?"] }), _jsx("p", { className: "mt-3 max-w-xl text-sm leading-relaxed opacity-75", children: "Search our documentation, browse common questions, or reach our support team. We respond to all provider inquiries within 4 business hours." }), _jsxs("form", { onSubmit: (e) => e.preventDefault(), className: "mt-6 flex max-w-xl items-center gap-2 rounded-sm border border-border/30 bg-background p-1.5", children: [_jsx(Search, { className: "ml-2 h-3.5 w-3.5 text-muted-foreground" }), _jsx("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search for answers \u2014 e.g. 'how do I invite a patient?'", className: "flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" }), _jsx(Button, { type: "submit", size: "sm", children: "Search" })] }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-400/80", children: [_jsx("span", { children: "Popular \u00B7" }), ['Invite a patient', 'Reset MFA', 'Billing & BAA'].map((tag) => (_jsx("button", { type: "button", onClick: () => setSearch(tag), className: "hover:text-gold-300", children: tag }, tag)))] })] }) }), _jsxs("section", { className: "grid gap-4 sm:grid-cols-3", children: [_jsx(ActionTile, { icon: _jsx(Book, { className: "h-5 w-5" }), title: "Documentation", description: "Full guides for every feature \u2014 onboarding, exercises, reports.", cta: "42 articles" }), _jsx(ActionTile, { icon: _jsx(PlayCircle, { className: "h-5 w-5" }), title: "Video tutorials", description: "Walkthroughs from the TMJConnect clinical team. Under 5 minutes each.", cta: "12 videos" }), _jsx(ActionTile, { icon: _jsx(MessageCircle, { className: "h-5 w-5" }), title: "Contact support", description: "Human support via email or live chat. 4-hour response on business days.", cta: "Start a conversation" })] }), _jsxs("section", { className: "grid gap-6 lg:grid-cols-[1.4fr_1fr]", children: [_jsxs("div", { children: [_jsxs("div", { className: "mb-4 flex items-baseline justify-between gap-3", children: [_jsx("h2", { className: "font-serif text-2xl tracking-tightest", children: "Frequently asked" }), _jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Sorted by how often providers ask" })] }), filteredFaqs.length === 0 ? (_jsxs("div", { className: "rounded-sm border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground", children: ["No matches for \"", _jsx("span", { className: "text-foreground", children: search }), "\". Try a different search or contact support."] })) : (_jsx("ul", { className: "overflow-hidden rounded-sm border border-border/70 bg-card", children: filteredFaqs.map((item, i) => (_jsxs("li", { className: cn('border-b border-border/40 last:border-b-0', openFaq === i && 'bg-gold-100/30'), children: [_jsxs("button", { onClick: () => setOpenFaq(openFaq === i ? null : i), className: "flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm text-foreground", children: [_jsx("span", { className: "font-serif text-base tracking-tightest", children: item.q }), _jsx(ChevronDown, { className: cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', openFaq === i && 'rotate-180 text-gold-700') })] }), openFaq === i && (_jsxs("div", { className: "border-t border-border/50 px-5 py-4", children: [_jsx("p", { className: "text-sm leading-relaxed text-muted-foreground", children: item.a }), item.cta && (_jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-3", children: [_jsxs("a", { href: "#", className: "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700 hover:text-gold-800", children: [item.cta, _jsx(ArrowRight, { className: "h-3 w-3" })] }), _jsx("a", { href: "#", className: "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground", children: "Watch 2-min video" })] }))] }))] }, item.q))) }))] }), _jsx(ContactForm, {})] }), _jsxs("section", { className: "grid gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 sm:grid-cols-3", children: [_jsx(FooterCard, { eyebrow: "System status", title: "All services operational", subtitle: "No incidents in last 90 days", link: "status.tmjconnect.com", icon: _jsx(CircleDot, { className: "h-3 w-3 text-ok" }) }), _jsx(FooterCard, { eyebrow: "Email support", title: "providers@tmjconnect.com", subtitle: "Typical response: 4 business hours", icon: _jsx(Mail, { className: "h-3 w-3 text-gold-700" }), mono: true }), _jsx(FooterCard, { eyebrow: "Clinical team", title: "Dr. Karen Liu, DDS", subtitle: "Clinical lead \u00B7 for clinical-content questions only", icon: _jsx(Stethoscope, { className: "h-3 w-3 text-navy-700" }) })] })] }));
}
function ActionTile({ icon, title, description, cta, }) {
    return (_jsxs("article", { className: "group flex flex-col gap-3 rounded-sm border border-border/70 bg-card p-5 shadow-navy-xs transition hover:-translate-y-0.5 hover:shadow-navy-sm", children: [_jsx("span", { className: "flex h-10 w-10 items-center justify-center rounded-sm bg-gold-600/15 text-gold-700", children: icon }), _jsxs("div", { children: [_jsx("h3", { className: "font-serif text-lg tracking-tightest text-foreground", children: title }), _jsx("p", { className: "mt-1 text-xs leading-relaxed text-muted-foreground", children: description })] }), _jsxs("a", { href: "#", className: "mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700 transition-colors group-hover:text-gold-800", children: [cta, _jsx(ArrowRight, { className: "h-3 w-3" })] })] }));
}
function ContactForm() {
    const [category, setCategory] = useState('technical');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [attachLog, setAttachLog] = useState(false);
    const [sent, setSent] = useState(false);
    function onSubmit(e) {
        e.preventDefault();
        // TODO(api): no /support/tickets endpoint yet — front-end stub only.
        setSent(true);
        setTimeout(() => setSent(false), 3000);
        setSubject('');
        setBody('');
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-4 flex items-baseline justify-between", children: [_jsx("h2", { className: "font-serif text-2xl tracking-tightest", children: "Still need help?" }), _jsx(Badge, { variant: "muted", children: "4-hour SLA" })] }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-4 rounded-sm border border-border/70 bg-card p-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Category" }), _jsxs(Select, { value: category, onValueChange: setCategory, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: CATEGORIES.map((c) => (_jsx(SelectItem, { value: c.value, children: c.label }, c.value))) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Subject" }), _jsx(Input, { value: subject, onChange: (e) => setSubject(e.target.value), placeholder: "Short summary of the issue", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Description" }), _jsx(Textarea, { value: body, onChange: (e) => setBody(e.target.value), placeholder: "Steps to reproduce, what you expected, what happened\u2026", rows: 5, required: true })] }), _jsxs("label", { className: "flex cursor-pointer items-start gap-2 text-xs text-muted-foreground", children: [_jsx("input", { type: "checkbox", checked: attachLog, onChange: (e) => setAttachLog(e.target.checked), className: "mt-0.5 accent-navy-600" }), "Attach diagnostic log (anonymized \u2014 no PHI)"] }), sent && (_jsx("div", { className: "rounded-sm border-l-2 border-ok bg-ok/5 px-3 py-2 text-xs text-ok-dark", children: "Ticket submitted. We'll reply within 4 business hours." })), _jsxs(Button, { type: "submit", className: "w-full", disabled: !subject || !body, children: [_jsx(Send, { className: "mr-2 h-3.5 w-3.5" }), "Submit ticket"] })] })] }));
}
function FooterCard({ eyebrow, title, subtitle, link, icon, mono, }) {
    return (_jsxs("div", { className: "bg-card p-5", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: [icon, eyebrow] }), _jsx("div", { className: cn('text-foreground', mono ? 'font-mono text-sm tracking-tight' : 'font-serif text-lg tracking-tightest'), children: title }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: subtitle }), link && (_jsxs("a", { href: `https://${link}`, className: "mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700 hover:text-gold-800", children: [link, _jsx(ArrowRight, { className: "h-3 w-3" })] }))] }));
}
// Activity / HelpCircle imports kept; HelpCircle is also used in the badge if added later.
export const _Helpers = { Activity, HelpCircle };
