import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Video, MessageSquare, BarChart3, Shield, Bell,
  ChevronRight, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    badge: 'Step 1 of 4',
    title: 'Welcome to TMJConnect',
    desc: 'You\'re all set up. Let\'s take a quick tour of your provider workspace — it only takes 60 seconds.',
    cards: null,
  },
  {
    badge: 'Step 2 of 4',
    title: 'Here\'s what you can do',
    desc: 'Your provider portal gives you everything you need to manage patients between clinic visits — all from your browser.',
    cards: [
      { icon: Users, label: 'Patient Dashboard', desc: 'See all patients at a glance with real-time pain trends and adherence rates', bg: 'bg-primary/10', color: 'text-primary' },
      { icon: Video, label: 'Exercise Videos', desc: 'Upload videos and assign them to patients with frequency and reminders', bg: 'bg-accent/10', color: 'text-accent' },
      { icon: MessageSquare, label: 'Patient Reports', desc: 'Receive urgent reports instantly. Respond with templates or custom messages', bg: 'bg-destructive/10', color: 'text-destructive' },
    ],
  },
  {
    badge: 'Step 3 of 4',
    title: 'Insights at your fingertips',
    desc: 'Track cross-patient analytics, exercise compliance, and pain trends — all in one dashboard.',
    cards: [
      { icon: BarChart3, label: 'Practice Analytics', desc: 'Pain trends, trigger patterns, and engagement metrics across your roster', bg: 'bg-primary/10', color: 'text-primary' },
      { icon: Shield, label: 'HIPAA Compliant', desc: 'End-to-end encryption, 15-min session timeout, audit trails on every action', bg: 'bg-emerald-500/10', color: 'text-emerald-600' },
      { icon: Bell, label: 'Smart Alerts', desc: 'Instant notifications for urgent reports, patient inactivity, and new connections', bg: 'bg-accent/10', color: 'text-accent' },
    ],
  },
  {
    badge: 'Step 4 of 4',
    title: 'Invite your first patient',
    desc: 'Generate a 6-character invite code and share it with your patient. They\'ll enter it in their mobile app to connect with you.',
    cards: null,
  },
] as const;

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else navigate('/dashboard', { replace: true });
  }

  function skip() {
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        {/* Progress dots */}
        <div className="mb-10 flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? 'w-8 bg-accent'
                  : i < step
                    ? 'w-8 bg-primary/40'
                    : 'w-8 bg-secondary'
              }`}
            />
          ))}
        </div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {current.badge}
        </div>

        <h1 className="mb-4 font-serif text-4xl tracking-tightest">
          {current.title.split(' ').map((word, i) =>
            i === current.title.split(' ').length - 1 ? (
              <em key={i} className="text-accent">{word}</em>
            ) : (
              <span key={i}>{word} </span>
            ),
          )}
        </h1>

        <p className="mb-10 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {current.desc}
        </p>

        {current.cards && (
          <div className="mb-10 grid w-full grid-cols-3 gap-4">
            {current.cards.map((card) => (
              <div
                key={card.label}
                className="rounded-sm border border-border/70 bg-card p-5 text-left"
              >
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-sm ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="mb-1 text-sm font-semibold">{card.label}</div>
                <p className="text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
              </div>
            ))}
          </div>
        )}

        {step === STEPS.length - 1 && (
          <div className="mb-10 w-full max-w-sm rounded-sm border border-dashed border-accent/40 bg-accent/5 p-8">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Quick start
            </div>
            <p className="text-sm text-muted-foreground">
              Head to <strong className="text-foreground">Linking</strong> in the sidebar to generate your first invite code, or explore the dashboard first.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={skip}
            className="px-6 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip tour
          </button>
          <Button onClick={next} className="gap-2">
            {step === STEPS.length - 1 ? (
              <>
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
