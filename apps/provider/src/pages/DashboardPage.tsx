import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ArrowUpRight, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDashboardSummary } from '@/features/dashboard/queries';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboardSummary();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Working late';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const kpis = [
    { n: '01', label: 'Active patients', value: data.activePatients, delta: 'linked & active', href: '/patients' },
    { n: '02', label: 'Unread reports', value: data.unreadReports, delta: 'in your inbox', href: '/reports', emphasis: data.unreadReports > 0 },
    { n: '03', label: 'Pending codes', value: data.pendingCodes, delta: 'invites unaccepted', href: '/linking' },
    { n: '04', label: 'Urgent this week', value: data.urgentInbox.length, delta: 'flagged for triage', href: '/reports' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <header className="flex items-end justify-between gap-8 border-b border-border/70 pb-8">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Folio № 01 — Overview
          </div>
          <h1 className="font-serif text-5xl tracking-tightest">
            {greeting},{' '}
            <em className="text-accent">
              {user?.firstName ?? 'doctor'}.
            </em>
          </h1>
        </div>
        <p className="max-w-xs text-right text-sm leading-relaxed text-muted-foreground">
          A calm daily read on what's changed since yesterday. Detail lives one
          click away.
        </p>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to={k.href}
            className={cn(
              'group relative flex flex-col justify-between gap-10 bg-card p-6 transition-colors hover:bg-secondary/40',
              k.emphasis && 'bg-primary text-primary-foreground hover:bg-primary',
            )}
          >
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  'font-mono text-[10px] uppercase tracking-[0.22em]',
                  k.emphasis ? 'text-primary-foreground/60' : 'text-muted-foreground',
                )}
              >
                № {k.n} · {k.label}
              </span>
              <ArrowUpRight
                className={cn(
                  'h-4 w-4 stroke-[1.5] opacity-0 transition-opacity group-hover:opacity-100',
                  k.emphasis ? 'text-accent' : 'text-foreground',
                )}
              />
            </div>
            <div>
              <div className="font-serif text-5xl tracking-tightest">
                {isLoading ? (
                  <span className="inline-block h-10 w-16 animate-pulse rounded-sm bg-secondary" />
                ) : (
                  k.value.toString().padStart(2, '0')
                )}
              </div>
              <div
                className={cn(
                  'mt-2 font-mono text-[10px] uppercase tracking-[0.22em]',
                  k.emphasis ? 'text-accent' : 'text-muted-foreground',
                )}
              >
                {k.delta}
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Urgent triage list */}
        <article className="rounded-sm border border-border/70 bg-card p-8">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl tracking-tightest">Needs your attention</h2>
            <Link
              to="/reports?urgency=urgent"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            >
              Open inbox →
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-sm bg-secondary" />
              ))}
            </div>
          ) : data.urgentInbox.length === 0 ? (
            <p className="rounded-sm border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              Nothing urgent. A good sign.
            </p>
          ) : (
            <ol className="space-y-2">
              {data.urgentInbox.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/reports/${r.id}`}
                    className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-sm border border-border/70 bg-background px-4 py-3 transition-colors hover:border-destructive/30 hover:bg-destructive/5"
                  >
                    <span className="inline-flex h-6 items-center rounded-sm border border-destructive/30 bg-destructive/5 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-destructive">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Urgent
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-serif text-base tracking-tightest">
                        {r.patient_first_name} {r.patient_last_name}
                      </div>
                      {r.description_preview && (
                        <div className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          {r.description_preview}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {r.flagged && <Flag className="h-3 w-3 fill-accent stroke-accent" />}
                      {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </article>

        {/* Recent patients */}
        <article className="rounded-sm border border-border/70 bg-card p-8">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl tracking-tightest">Recent patients</h2>
            <Link
              to="/patients"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            >
              All →
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-sm bg-secondary" />
              ))}
            </div>
          ) : data.recentPatients.length === 0 ? (
            <p className="rounded-sm border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              No patients yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {data.recentPatients.slice(0, 6).map((p, i) => (
                <li key={p.patient_id}>
                  <Link
                    to={`/patients/${p.patient_id}`}
                    className="flex items-center justify-between gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0 hover:text-accent"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="truncate font-serif text-base tracking-tightest">
                        {p.first_name} {p.last_name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {p.last_symptom_at
                        ? formatDistanceToNow(new Date(p.last_symptom_at), { addSuffix: true })
                        : '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </div>
  );
}
