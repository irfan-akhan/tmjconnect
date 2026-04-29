import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Book,
  ChevronDown,
  CircleDot,
  HelpCircle,
  Mail,
  MessageCircle,
  PlayCircle,
  Search,
  Send,
  Stethoscope,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useCreateSupportTicket,
  type SupportTicketCategory,
} from '@/features/support/queries';

type Faq = { q: string; a: string; cta?: string };

const FAQS: Faq[] = [
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [search, setSearch] = useState('');
  const firstName = user?.firstName ?? 'Provider';

  const filteredFaqs = search
    ? FAQS.filter(
        (f) =>
          f.q.toLowerCase().includes(search.toLowerCase()) ||
          f.a.toLowerCase().includes(search.toLowerCase()),
      )
    : FAQS;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <section className="grain relative overflow-hidden rounded-sm bg-gradient-to-br from-navy-700 to-navy-900 p-8 text-background sm:p-12">
        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-300">
            Help center
          </div>
          <h1 className="font-serif text-3xl leading-tight tracking-tightest sm:text-4xl">
            How can we help today, Dr. {firstName}?
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed opacity-75">
            Search our documentation, browse common questions, or reach our support team. We respond
            to all provider inquiries within 4 business hours.
          </p>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="mt-6 flex max-w-xl items-center gap-2 rounded-sm border border-border/30 bg-background p-1.5"
          >
            <Search className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for answers — e.g. 'how do I invite a patient?'"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-300">
            <span>Popular ·</span>
            {['Invite a patient', 'Reset MFA', 'Billing & BAA'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSearch(tag)}
                className="hover:text-gold-200"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Quick action tiles ────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-3">
        <ActionTile
          icon={<Book className="h-5 w-5" />}
          title="Documentation"
          description="Full guides for every feature — onboarding, exercises, reports."
          cta="42 articles"
        />
        <ActionTile
          icon={<PlayCircle className="h-5 w-5" />}
          title="Video tutorials"
          description="Walkthroughs from the TMJConnect clinical team. Under 5 minutes each."
          cta="12 videos"
        />
        <ActionTile
          icon={<MessageCircle className="h-5 w-5" />}
          title="Contact support"
          description="Human support via email or live chat. 4-hour response on business days."
          cta="Start a conversation"
        />
      </section>

      {/* ─── FAQ + Contact ────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl tracking-tightest">Frequently asked</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Sorted by how often providers ask
            </span>
          </div>
          {filteredFaqs.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No matches for "<span className="text-foreground">{search}</span>". Try a different
              search or contact support.
            </div>
          ) : (
            <ul className="overflow-hidden rounded-sm border border-border/70 bg-card">
              {filteredFaqs.map((item, i) => (
                <li
                  key={item.q}
                  className={cn(
                    'border-b border-border/40 last:border-b-0',
                    openFaq === i && 'bg-gold-100/30',
                  )}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm text-foreground"
                  >
                    <span className="font-serif text-base tracking-tightest">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                        openFaq === i && 'rotate-180 text-gold-700',
                      )}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-border/50 px-5 py-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                      {item.cta && (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <a
                            href="#"
                            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700 hover:text-gold-800"
                          >
                            {item.cta}
                            <ArrowRight className="h-3 w-3" />
                          </a>
                          <a
                            href="#"
                            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
                          >
                            Watch 2-min video
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <ContactForm />
      </section>

      {/* ─── Footer trio ──────────────────────────────────────────── */}
      <section className="grid gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 sm:grid-cols-3">
        <FooterCard
          eyebrow="System status"
          title="All services operational"
          subtitle="No incidents in last 90 days"
          link="status.tmjconnect.com"
          icon={<CircleDot className="h-3 w-3 text-ok" />}
        />
        <FooterCard
          eyebrow="Email support"
          title="providers@tmjconnect.com"
          subtitle="Typical response: 4 business hours"
          icon={<Mail className="h-3 w-3 text-gold-700" />}
          mono
        />
        <FooterCard
          eyebrow="Clinical team"
          title="Dr. Karen Liu, DDS"
          subtitle="Clinical lead · for clinical-content questions only"
          icon={<Stethoscope className="h-3 w-3 text-navy-700" />}
        />
      </section>
    </div>
  );
}

function ActionTile({
  icon,
  title,
  description,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <article className="group flex flex-col gap-3 rounded-sm border border-border/70 bg-card p-5 shadow-navy-xs transition hover:-translate-y-0.5 hover:shadow-navy-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-gold-600/15 text-gold-700">
        {icon}
      </span>
      <div>
        <h3 className="font-serif text-lg tracking-tightest text-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <a
        href="#"
        className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700 transition-colors group-hover:text-gold-800"
      >
        {cta}
        <ArrowRight className="h-3 w-3" />
      </a>
    </article>
  );
}

function ContactForm() {
  const [category, setCategory] = useState<SupportTicketCategory>('technical');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachLog, setAttachLog] = useState(false);
  const [sent, setSent] = useState(false);
  const create = useCreateSupportTicket();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        category,
        subject,
        body,
        attach_diagnostic: attachLog,
      });
      setSent(true);
      setSubject('');
      setBody('');
      setTimeout(() => setSent(false), 4000);
    } catch {
      // Toast handled by the mutation onError.
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl tracking-tightest">Still need help?</h2>
        <Badge variant="muted">4-hour SLA</Badge>
      </div>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-sm border border-border/70 bg-card p-5"
      >
        <div className="space-y-2">
          <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Category
          </Label>
          <Select value={category} onValueChange={(v) => setCategory(v as SupportTicketCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Subject
          </Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary of the issue"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Description
          </Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Steps to reproduce, what you expected, what happened…"
            rows={5}
            required
          />
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={attachLog}
            onChange={(e) => setAttachLog(e.target.checked)}
            className="mt-0.5 accent-navy-600"
          />
          Attach diagnostic log (anonymized — no PHI)
        </label>
        {sent && (
          <div className="rounded-sm border-l-2 border-ok bg-ok/5 px-3 py-2 text-xs text-ok-dark">
            Ticket submitted. We'll reply within 4 business hours.
          </div>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={!subject || body.length < 10 || create.isPending}
        >
          <Send className="mr-2 h-3.5 w-3.5" />
          {create.isPending ? 'Submitting…' : 'Submit ticket'}
        </Button>
      </form>
    </div>
  );
}

function FooterCard({
  eyebrow,
  title,
  subtitle,
  link,
  icon,
  mono,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  link?: string;
  icon: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="bg-card p-5">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {icon}
        {eyebrow}
      </div>
      <div
        className={cn(
          'text-foreground',
          mono ? 'font-mono text-sm tracking-tight' : 'font-serif text-lg tracking-tightest',
        )}
      >
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      {link && (
        <a
          href={`https://${link}`}
          className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700 hover:text-gold-800"
        >
          {link}
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// Activity / HelpCircle imports kept; HelpCircle is also used in the badge if added later.
export const _Helpers = { Activity, HelpCircle };
