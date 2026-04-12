import { type ReactNode } from 'react';
import { HeartFilled, SafetyCertificateOutlined, LockOutlined, ThunderboltOutlined } from '@ant-design/icons';

interface AuthShellProps {
  children: ReactNode;
}

/**
 * AuthShell — split-screen brand layout used by LoginPage and MfaPage.
 *
 *   ┌───────────────────────┬───────────────────┐
 *   │  Brand panel (left)   │  Form (right)     │
 *   │  - Logo               │  - Page-specific  │
 *   │  - Headline           │    auth UI        │
 *   │  - Trust signals      │                   │
 *   └───────────────────────┴───────────────────┘
 *
 * On mobile the brand panel collapses; only the form remains.
 * The form panel reads `html.dark` so it picks up the user's theme even
 * before they reach the AdminLayout.
 */
export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ─── Brand panel ───────────────────────────────────────────────── */}
      <div className="bg-brand-gradient bg-dotted-grid relative hidden flex-1 flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-400 opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-300 opacity-20 blur-3xl" />

        {/* Top: brand */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <HeartFilled style={{ fontSize: 22, color: '#fff' }} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-tight">TMJConnect</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-brand-200">
              Admin Console
            </span>
          </div>
        </div>

        {/* Middle: headline */}
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Calm, secure care orchestration for orofacial pain teams.
          </h1>
          <p className="mt-4 text-base text-brand-100">
            Monitor patient activity, manage providers, and audit every interaction
            from a single HIPAA-aware control plane.
          </p>
        </div>

        {/* Bottom: trust signals */}
        <div className="relative grid grid-cols-3 gap-6 text-xs">
          <div className="flex items-start gap-2">
            <SafetyCertificateOutlined className="mt-0.5 text-brand-200" />
            <div>
              <div className="font-semibold text-white">HIPAA-aware</div>
              <div className="text-brand-200">Append-only audit log</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <LockOutlined className="mt-0.5 text-brand-200" />
            <div>
              <div className="font-semibold text-white">MFA enforced</div>
              <div className="text-brand-200">Required for every admin</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ThunderboltOutlined className="mt-0.5 text-brand-200" />
            <div>
              <div className="font-semibold text-white">Real-time</div>
              <div className="text-brand-200">Live operations view</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Form panel ────────────────────────────────────────────────── */}
      <div className="flex w-full items-center justify-center p-6 lg:w-[480px] lg:flex-none">
        <div className="w-full max-w-sm animate-fade-in-up">{children}</div>
      </div>
    </div>
  );
}
