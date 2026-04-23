import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import {
  ArrowRight,
  Dumbbell,
  FileText,
  LayoutDashboard,
  Link2,
  Moon,
  Plus,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PatientRow } from '@/features/patients/types';
import { useTheme } from '@/components/ThemeProvider';
import { useGenerateCode } from '@/features/linking/queries';
import { cn } from '@/lib/utils';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

function usePatientSearch(query: string) {
  return useQuery({
    queryKey: ['cmdk', 'patients', query],
    queryFn: () =>
      apiFetch<{ data: PatientRow[] }>('/providers/patients', {
        query: { page: 1, limit: 8, search: query || undefined },
      }).then((r) => r.data),
    staleTime: 10_000,
  });
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const generate = useGenerateCode();
  const [query, setQuery] = useState('');

  const patients = usePatientSearch(query);

  function close() {
    onOpenChange(false);
    setQuery('');
  }

  function go(path: string) {
    close();
    navigate(path);
  }

  async function onGenerateCode() {
    close();
    await generate.mutateAsync();
    navigate('/linking');
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-xl -translate-x-1/2 rounded-sm border border-border/70 bg-popover shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <Command label="Command menu">
            <div className="flex items-center gap-3 border-b border-border/70 px-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                ⌘K
              </span>
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Jump to patient, page, or action…"
                className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                esc
              </span>
            </div>

            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Nothing matches.
              </Command.Empty>

              {(patients.data?.length ?? 0) > 0 && (
                <Group label="Patients">
                  {patients.data!.map((p) => (
                    <Item
                      key={p.patient_id}
                      value={`patient ${p.first_name} ${p.last_name}`}
                      onSelect={() => go(`/patients/${p.patient_id}`)}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-secondary font-mono text-[10px] tracking-wider text-muted-foreground">
                        {`${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase()}
                      </div>
                      <span className="flex-1 truncate font-serif text-sm tracking-tightest">
                        {p.first_name} {p.last_name}
                      </span>
                      {p.avg_pain_7d != null && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Pain {p.avg_pain_7d.toFixed(1)}
                        </span>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Item>
                  ))}
                </Group>
              )}

              <Group label="Go to">
                <Item value="go dashboard overview home" onSelect={() => go('/dashboard')}>
                  <LayoutDashboard className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  Dashboard
                  <Shortcut keys={['G', 'D']} />
                </Item>
                <Item value="go patients people" onSelect={() => go('/patients')}>
                  <Users className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  Patients
                  <Shortcut keys={['G', 'P']} />
                </Item>
                <Item value="go reports inbox" onSelect={() => go('/reports')}>
                  <FileText className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  Reports inbox
                  <Shortcut keys={['G', 'R']} />
                </Item>
                <Item value="go exercises library" onSelect={() => go('/exercises')}>
                  <Dumbbell className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  Exercise library
                  <Shortcut keys={['G', 'E']} />
                </Item>
                <Item value="go linking codes invite" onSelect={() => go('/linking')}>
                  <Link2 className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  Linking codes
                  <Shortcut keys={['G', 'L']} />
                </Item>
                <Item value="go settings profile sessions" onSelect={() => go('/settings')}>
                  <Settings className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  Settings
                  <Shortcut keys={['G', 'S']} />
                </Item>
              </Group>

              <Group label="Actions">
                <Item
                  value="action generate linking code new patient invite"
                  onSelect={onGenerateCode}
                >
                  <Plus className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  Generate new linking code
                </Item>
                <Item
                  value="action toggle theme dark light mode"
                  onSelect={() => {
                    toggle();
                    close();
                  }}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  ) : (
                    <Moon className="h-4 w-4 stroke-[1.5] text-muted-foreground" />
                  )}
                  Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                </Item>
              </Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={label}
      className="pb-2 [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.22em] [&_[cmdk-group-heading]]:text-muted-foreground"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm outline-none',
        'data-[selected=true]:bg-secondary data-[selected=true]:text-foreground',
      )}
    >
      {children}
    </Command.Item>
  );
}

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="ml-auto flex gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** ⌘K / Ctrl+K to toggle; `g X` prefix for route navigation. */
export function useCommandPaletteHotkeys({
  onToggle,
  onNavigate,
}: {
  onToggle: () => void;
  onNavigate: (path: string) => void;
}) {
  const bindings: Record<string, string> = useMemo(
    () => ({
      d: '/dashboard',
      p: '/patients',
      r: '/reports',
      e: '/exercises',
      l: '/linking',
      s: '/settings',
    }),
    [],
  );
  const state = useMemo(() => ({ gPressedAt: 0 }), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggle();
        return;
      }

      if (isEditable) return;

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        state.gPressedAt = Date.now();
        return;
      }

      const within = Date.now() - state.gPressedAt < 800;
      if (within && bindings[e.key.toLowerCase()]) {
        e.preventDefault();
        onNavigate(bindings[e.key.toLowerCase()]);
        state.gPressedAt = 0;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bindings, onNavigate, onToggle, state]);
}
