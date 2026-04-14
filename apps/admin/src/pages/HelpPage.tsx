import { useState } from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';

interface ShortcutEntry {
  keys: string[];
  label: string;
  group: string;
}

const ALL_SHORTCUTS: ShortcutEntry[] = [
  // Navigation
  { keys: ['g', 'd'], label: 'Go to Dashboard', group: 'Navigation' },
  { keys: ['g', 'u'], label: 'Go to Users', group: 'Navigation' },
  { keys: ['g', 'a'], label: 'Go to Audit logs', group: 'Navigation' },
  { keys: ['g', 'l'], label: 'Go to Login events', group: 'Navigation' },
  { keys: ['g', 'r'], label: 'Go to Reports', group: 'Navigation' },
  { keys: ['g', 's'], label: 'Go to Settings', group: 'Navigation' },
  { keys: ['g', 'h'], label: 'Open this help page', group: 'Navigation' },
  // Actions
  { keys: ['⌘', 'K'], label: 'Open command palette', group: 'Actions' },
  { keys: ['/'], label: 'Open command palette', group: 'Actions' },
  { keys: ['t'], label: 'Toggle light / dark theme', group: 'Actions' },
  { keys: ['?'], label: 'Open keyboard shortcut modal', group: 'Actions' },
  { keys: ['Esc'], label: 'Close any modal', group: 'Actions' },
  // Palette
  { keys: ['↑'], label: 'Highlight previous result', group: 'Inside command palette' },
  { keys: ['↓'], label: 'Highlight next result', group: 'Inside command palette' },
  { keys: ['Enter'], label: 'Open highlighted result', group: 'Inside command palette' },
];

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'Where do my preferences live?',
    answer:
      'In your browser. Theme, density, time zone, default landing page, and read-only mode are stored in localStorage and never sent to the server. They reset if you sign out on a shared machine.',
  },
  {
    question: 'What does read-only mode actually do?',
    answer:
      'It disables every mutating button across the console (deactivate, force reset, role change, etc.). API calls are not blocked at the network layer — it is a UI safety net while you explore. Toggle it from the topbar lock icon or Settings.',
  },
  {
    question: 'How does live activity work?',
    answer:
      'The dashboard polls /admin/audit-logs every 10 seconds. When the tab is hidden it pauses to save quota. There is no WebSocket today; if you need sub-second latency tell us.',
  },
  {
    question: 'Why does the audit logs page have "Quick views"?',
    answer:
      'Saved filter presets persist to your browser. Use them for recurring investigations like "Failed logins 24h" so you do not have to rebuild the filter every time.',
  },
  {
    question: 'How do I export only the rows I selected?',
    answer:
      'On the Users page, tick the checkboxes on the rows you care about, then choose "Export selected" from the Export dropdown.',
  },
  {
    question: 'Can I share a filtered view?',
    answer:
      'Yes — every list page mirrors its filters into the URL query string. Copy the URL and the recipient gets the same view (with their own auth).',
  },
  {
    question: 'How do I copy a UUID quickly?',
    answer:
      'Click any truncated ID chip in any table. The full value lands on your clipboard and a toast confirms the copy.',
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[24px] items-center justify-center rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </kbd>
  );
}

export default function HelpPage() {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filteredShortcuts = q
    ? ALL_SHORTCUTS.filter(
        (s) => s.label.toLowerCase().includes(q) || s.keys.join(' ').toLowerCase().includes(q),
      )
    : ALL_SHORTCUTS;

  const grouped = filteredShortcuts.reduce<Record<string, ShortcutEntry[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  const filteredFaq = q
    ? FAQ.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q),
      )
    : FAQ;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Help & shortcuts"
        subtitle="Searchable cheatsheet of every keyboard shortcut and how-to in the admin console."
      />

      <div className="mb-6">
        <Input
          size="large"
          placeholder="Search shortcuts and FAQs…"
          prefix={<SearchOutlined className="text-slate-400" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
        />
      </div>

      {/* ─── Shortcuts ─────────────────────────────────────────────── */}
      <SectionCard title="Keyboard shortcuts" className="mb-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No shortcuts match "{query}".
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {group}
                </div>
                <ul className="flex flex-col gap-2">
                  {items.map((s) => (
                    <li
                      key={s.label + s.keys.join('-')}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-xs text-slate-700 dark:text-slate-200">{s.label}</span>
                      <span className="flex items-center gap-1">
                        {s.keys.map((k, i) => (
                          <Kbd key={i}>{k}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── FAQ ───────────────────────────────────────────────────── */}
      <SectionCard title="Frequently asked" className="mb-6">
        {filteredFaq.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No FAQs match "{query}".
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
            {filteredFaq.map((f) => (
              <li key={f.question} className="py-3 first:pt-0 last:pb-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {f.question}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{f.answer}</div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Need more help?">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Backend feature requests live in <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">apps/admin/TODO.md</code>.
          Frontend bugs and tweaks should be filed against the admin app repo.
        </p>
      </SectionCard>
    </div>
  );
}
