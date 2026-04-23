import { useState } from 'react';
import {
  Book, Mail, Shield, ChevronDown, ChevronUp,
} from 'lucide-react';

const HELP_CARDS = [
  { icon: Book, label: 'Getting Started Guide', desc: 'Learn how to set up your account, invite patients, and use the dashboard', bg: 'bg-primary/10', color: 'text-primary' },
  { icon: Mail, label: 'Contact Support', desc: 'Email us at support@tmjconnect.com. We respond within 24 business hours', bg: 'bg-accent/10', color: 'text-accent' },
  { icon: Shield, label: 'HIPAA & Security', desc: 'Learn about our compliance measures, encryption, and data handling policies', bg: 'bg-emerald-500/10', color: 'text-emerald-600' },
];

const FAQ = [
  { q: 'How do I invite a patient to connect?', a: 'Go to "Linking" in the sidebar. Generate a 6-character invite code and share it with your patient. They will enter the code in their mobile app to connect with you. Codes expire after 7 days or after a single use.' },
  { q: 'How do I upload exercise videos?', a: 'Navigate to Exercises in the sidebar and click "New exercise". You can upload MP4 or MOV files up to 100MB. Add a title, category, and instructions before saving.' },
  { q: 'What happens when a patient sends an Urgent report?', a: 'You\'ll receive an immediate push notification, email alert, and the report will appear at the top of your Reports inbox with a red urgency badge. Respond directly from the inbox.' },
  { q: 'Can my patient be linked to multiple providers?', a: 'Yes. A patient can accept invite codes from multiple providers. Each provider only sees data from their own linked patients — there is no cross-provider visibility.' },
  { q: 'How long before my session times out?', a: 'Provider sessions auto-expire after 15 minutes of inactivity. This is a HIPAA compliance requirement. You\'ll see a re-authentication modal when the session expires.' },
];

export function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <header className="border-b border-border/70 pb-8">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Folio № 07 — Support
        </div>
        <h1 className="font-serif text-5xl tracking-tightest">
          Help & <em className="text-accent">support.</em>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Find answers, contact support, and review legal documents.
        </p>
      </header>

      {/* Help Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        {HELP_CARDS.map((card) => (
          <div
            key={card.label}
            className="cursor-pointer rounded-sm border border-border/70 bg-card p-6 transition-all hover:border-border hover:shadow-sm"
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-sm ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div className="mb-1 text-sm font-semibold">{card.label}</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-4 font-serif text-2xl tracking-tightest">Frequently asked questions</h2>
        <div className="overflow-hidden rounded-sm border border-border/70">
          {FAQ.map((item, i) => (
            <div key={i} className="border-b border-border/70 last:border-b-0">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary/50"
              >
                {item.q}
                {openFaq === i ? (
                  <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
              </button>
              {openFaq === i && (
                <div className="border-t border-border/70 bg-secondary/20 px-6 py-4 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Legal */}
      <section>
        <h2 className="mb-4 font-serif text-2xl tracking-tightest">Legal documents</h2>
        <div className="max-h-64 overflow-y-auto rounded-sm border border-border/70 bg-card p-6 text-sm leading-relaxed text-muted-foreground">
          <h3 className="mb-2 text-base font-bold text-foreground">1. Terms of Service</h3>
          <p className="mb-4">
            By using TMJConnect, you agree to these terms. The app provides health tracking and exercise guidance tools. It is not a substitute for professional medical advice, diagnosis, or treatment.
          </p>
          <h3 className="mb-2 text-base font-bold text-foreground">2. Privacy Policy</h3>
          <p className="mb-4">
            We collect personal information including name, email, and health data to provide our services. Your health data is encrypted and stored securely in compliance with HIPAA regulations.
          </p>
          <h3 className="mb-2 text-base font-bold text-foreground">3. Business Associate Agreement (BAA)</h3>
          <p className="mb-4">
            A BAA is available for all provider accounts. Contact support@tmjconnect.com to request a copy.
          </p>
          <h3 className="mb-2 text-base font-bold text-foreground">4. Emergency Disclaimer</h3>
          <p>
            This platform is not for medical emergencies. If you are experiencing a medical emergency, call 911 immediately.
          </p>
        </div>
      </section>
    </div>
  );
}
