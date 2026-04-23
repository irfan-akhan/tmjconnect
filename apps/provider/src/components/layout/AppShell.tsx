import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Inbox,
  Link2,
  BarChart3,
  ClipboardList,
  HelpCircle,
  Settings,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { useUnreadReportsCount } from '@/features/dashboard/queries';
import { useProfile } from '@/features/settings/queries';
import { CommandPalette, useCommandPaletteHotkeys } from '@/components/CommandPalette';
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal';

const nav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, kbd: '01' },
  { to: '/patients', label: 'Patients', icon: Users, kbd: '02' },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell, kbd: '03' },
  { to: '/reports', label: 'Reports', icon: Inbox, kbd: '04' },
  { to: '/linking', label: 'Linking', icon: Link2, kbd: '05' },
  { to: '/intake-forms', label: 'Intake Forms', icon: ClipboardList, kbd: '06' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, kbd: '07' },
  { to: '/help', label: 'Help & Support', icon: HelpCircle, kbd: '07' },
  { to: '/settings', label: 'Settings', icon: Settings, kbd: '08' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const unreadReports = useUnreadReportsCount();
  const profile = useProfile();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

  const displayName =
    profile.data?.first_name && profile.data?.last_name
      ? `${profile.data.first_name} ${profile.data.last_name}`
      : user?.firstName
      ? `${user.firstName} ${user.lastName ?? ''}`
      : 'Provider';
  const avatarUrl = profile.data?.avatar_url ?? null;
  const initials = `${(profile.data?.first_name ?? user?.firstName ?? '')[0] ?? ''}${
    (profile.data?.last_name ?? user?.lastName ?? '')[0] ?? ''
  }`.toUpperCase() || '—';

  useCommandPaletteHotkeys({
    onToggle: () => setPaletteOpen((v) => !v),
    onNavigate: (path) => navigate(path),
  });
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="grid min-h-screen grid-cols-[16rem_1fr] bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-foreground focus:px-4 focus:py-2 focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-[0.22em] focus:text-background"
      >
        Skip to content
      </a>
      <aside className="relative flex flex-col border-r border-border/70 bg-card">
        <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <span className="font-serif text-base italic leading-none">t</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-[15px] tracking-tightest">TMJ Connect</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Provider · v1
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5">
          <div className="mb-3 px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Practice
          </div>
          <ul className="space-y-px">
            {nav.map(({ to, label, icon: Icon, kbd }) => {
              const badge = to === '/reports' ? unreadReports.data ?? 0 : 0;
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                        isActive &&
                          'bg-secondary text-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:bg-accent',
                      )
                    }
                  >
                    <Icon className="h-4 w-4 stroke-[1.5]" />
                    <span className="flex-1">{label}</span>
                    {badge > 0 ? (
                      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm bg-accent px-1.5 font-mono text-[10px] tracking-wider text-accent-foreground">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground/60">{kbd}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border/70 p-3">
          <div className="mb-3 flex items-center gap-3 rounded-sm bg-secondary/50 p-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-10 w-10 flex-shrink-0 rounded-sm border border-border object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-primary font-serif text-sm tracking-tightest text-primary-foreground">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-serif text-sm">{displayName}</div>
              <div className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {user?.email}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/70 bg-background/60 px-8 backdrop-blur">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {today}
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Shift in session
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-sm px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5">⌘</kbd>
            <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5">K</kbd>
            <span>search</span>
          </button>
        </header>
        <div id="main-content" className="flex-1 px-8 py-10" tabIndex={-1}>
          <Outlet />
        </div>

      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <SessionTimeoutModal />
    </div>
  );
}
