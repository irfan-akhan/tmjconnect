import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  CircleDot,
  Dumbbell,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { useUnreadReportsCount } from '@/features/dashboard/queries';
import { useProfile } from '@/features/settings/queries';
import { CommandPalette, useCommandPaletteHotkeys } from '@/components/CommandPalette';
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal';

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

type NavSection = { label: string; items: NavItem[] };

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  patients: 'Patients',
  reports: 'Reports',
  exercises: 'Exercise Library',
  linking: 'Invite & Link',
  analytics: 'Analytics',
  'intake-forms': 'Intake Forms',
  settings: 'Settings',
  help: 'Help & Support',
};

function useBreadcrumbs() {
  const { pathname } = useLocation();
  return useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [{ label: 'Dashboard', href: '/dashboard', isLast: true }];
    return parts.map((slug, i) => {
      const href = '/' + parts.slice(0, i + 1).join('/');
      const label = ROUTE_LABELS[slug] ?? decodeURIComponent(slug);
      return { label, href, isLast: i === parts.length - 1 };
    });
  }, [pathname]);
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const unread = useUnreadReportsCount();
  const profile = useProfile();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const crumbs = useBreadcrumbs();

  useCommandPaletteHotkeys({
    onToggle: () => setPaletteOpen((v) => !v),
    onNavigate: (path) => navigate(path),
  });

  const sections: NavSection[] = [
    {
      label: 'Workspace',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/patients', label: 'Patients', icon: Users },
        { to: '/reports', label: 'Reports', icon: Inbox, badge: unread.data ?? 0 },
        { to: '/exercises', label: 'Exercise Library', icon: Dumbbell },
        { to: '/intake-forms', label: 'Intake Forms', icon: ClipboardList },
      ],
    },
    {
      label: 'Manage',
      items: [
        { to: '/linking', label: 'Invite & Link', icon: Link2 },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/settings', label: 'Settings', icon: Settings },
        { to: '/help', label: 'Help & Support', icon: HelpCircle },
      ],
    },
  ];

  const displayName =
    profile.data?.first_name && profile.data?.last_name
      ? `${profile.data.first_name} ${profile.data.last_name}`
      : user?.firstName
        ? `${user.firstName} ${user.lastName ?? ''}`
        : 'Provider';
  const creds = profile.data?.credentials?.join(', ');
  const userMeta =
    [creds, profile.data?.specialty].filter(Boolean).join(' · ') || 'Provider';
  const clinicTagline = profile.data?.clinic_name || 'Provider workspace';
  const avatarUrl = profile.data?.avatar_url ?? null;
  const userInitials = initials(profile.data?.first_name ?? user?.firstName, profile.data?.last_name ?? user?.lastName);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid min-h-screen grid-cols-[16rem_1fr] bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-foreground focus:px-4 focus:py-2 focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-[0.22em] focus:text-background"
        >
          Skip to content
        </a>

        {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="relative flex flex-col border-r border-border/70 bg-card">
          {/* Brand */}
          <div className="flex h-16 shrink-0 items-center gap-3 px-5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-sm bg-gradient-to-br from-navy-600 to-navy-800 text-gold-400 shadow-navy-xs">
              <span className="font-serif text-lg italic leading-none">t</span>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] border-card bg-gold-500" />
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-serif text-[15px] tracking-tightest">TMJConnect</span>
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {clinicTagline}
              </span>
            </div>
          </div>

          {/* Hairline separator */}
          <div className="mx-5 h-px bg-border/60" />

          {/* Search trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group mx-3 mt-3 flex items-center gap-2 rounded-sm border border-border/60 bg-secondary/30 px-3 py-2 text-left transition-colors hover:border-gold-600/40 hover:bg-secondary/60"
          >
            <Search className="h-3.5 w-3.5 stroke-[1.75] text-muted-foreground transition-colors group-hover:text-gold-700" />
            <span className="flex-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Search…
            </span>
            <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Nav sections */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {sections.map((section) => (
              <div key={section.label} className="mb-5 last:mb-0">
                <div className="mb-2 flex items-center gap-2 px-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {section.label}
                  </span>
                  <span className="h-px flex-1 bg-border/40" />
                </div>
                <ul className="space-y-0.5">
                  {section.items.map(({ to, label, icon: Icon, badge }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-gold-100/40 font-medium text-foreground before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-sm before:bg-gold-600'
                              : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={cn(
                                'h-4 w-4 stroke-[1.5] transition-colors',
                                isActive && 'text-gold-700',
                              )}
                            />
                            <span className="flex-1">{label}</span>
                            {badge && badge > 0 ? (
                              <Badge variant="urgent">{badge > 99 ? '99+' : badge}</Badge>
                            ) : (
                              <ChevronRight
                                className={cn(
                                  'h-3 w-3 text-muted-foreground/50 transition-opacity',
                                  isActive ? 'opacity-100 text-gold-700' : 'opacity-0 group-hover:opacity-100',
                                )}
                              />
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer user card */}
          <div className="border-t border-border/60 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-sm border border-transparent p-2 text-left transition-colors hover:border-border/70 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative shrink-0">
                    <Avatar size="md">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                      <AvatarFallback className="bg-navy-600 text-background">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-[1.5px] border-card bg-ok" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-sm tracking-tightest text-foreground">
                      {displayName}
                    </div>
                    <div className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {userMeta}
                    </div>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-56">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Signed in as
                </DropdownMenuLabel>
                <div className="truncate px-2 pb-2 text-sm">{user?.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggle}>
                  {theme === 'dark' ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* System-status strip */}
            <div className="mt-2 flex items-center justify-between px-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CircleDot className="h-2.5 w-2.5 text-ok" />
                All systems operational
              </span>
              <span className="text-muted-foreground/60">v2.0</span>
            </div>
          </div>
        </aside>

        {/* ─── Main column ─────────────────────────────────────────────────── */}
        <main className="flex flex-col">
          <header className="flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-8 backdrop-blur">
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((c, i) => (
                  <BreadcrumbItem key={c.href}>
                    {c.isLast ? (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    ) : (
                      <Link to={c.href} className="transition-colors hover:text-foreground">
                        {c.label}
                      </Link>
                    )}
                    {i < crumbs.length - 1 && <BreadcrumbSeparator />}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => navigate('/reports')}
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`Notifications${unread.data ? ` — ${unread.data} unread` : ''}`}
                  >
                    <Bell className="h-4 w-4" />
                    {(unread.data ?? 0) > 0 && (
                      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-err" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {(unread.data ?? 0) > 0 ? `${unread.data} new` : 'No new notifications'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => navigate('/help')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Help"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Help & support</TooltipContent>
              </Tooltip>

              <span className="mx-2 h-5 w-px bg-border" aria-hidden />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-sm p-1 transition-colors hover:bg-secondary"
                    aria-label="Account menu"
                  >
                    <Avatar size="sm">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                      <AvatarFallback className="bg-navy-600 text-background">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-sm font-normal">
                    {displayName}
                  </DropdownMenuLabel>
                  <div className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {user?.email}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Account settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void logout()} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div id="main-content" className="flex-1 px-8 py-8" tabIndex={-1}>
            <Outlet />
          </div>
        </main>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <SessionTimeoutModal />
      </div>
    </TooltipProvider>
  );
}
