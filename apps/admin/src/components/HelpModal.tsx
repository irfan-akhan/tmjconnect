import { Modal } from 'antd';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; label: string }[];
}

const groups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['g', 'd'], label: 'Go to Dashboard' },
      { keys: ['g', 'u'], label: 'Go to Users' },
      { keys: ['g', 'a'], label: 'Go to Audit logs' },
      { keys: ['g', 'l'], label: 'Go to Login events' },
      { keys: ['g', 'r'], label: 'Go to Reports' },
      { keys: ['g', 's'], label: 'Go to Settings' },
      { keys: ['g', 'h'], label: 'Open this help' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['⌘', 'K'], label: 'Open command palette' },
      { keys: ['/'], label: 'Open command palette' },
      { keys: ['t'], label: 'Toggle light / dark theme' },
      { keys: ['?'], label: 'Open this help' },
      { keys: ['Esc'], label: 'Close any modal' },
    ],
  },
  {
    title: 'Inside the command palette',
    shortcuts: [
      { keys: ['↑'], label: 'Highlight previous result' },
      { keys: ['↓'], label: 'Highlight next result' },
      { keys: ['Enter'], label: 'Open highlighted result' },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[24px] items-center justify-center rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </kbd>
  );
}

/**
 * HelpModal — global keyboard shortcut cheatsheet. Reachable via `?` or
 * `g h` from anywhere in the app.
 */
export default function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Keyboard shortcuts"
      width={580}
      destroyOnClose
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {g.title}
            </div>
            <ul className="flex flex-col gap-2">
              {g.shortcuts.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3">
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
      <div className="mt-6 rounded-md border border-brand-100 bg-brand-50 p-3 text-xs text-brand-800 dark:border-brand-700 dark:bg-brand-900/20 dark:text-brand-200">
        Tip: shortcuts are suppressed while you're typing in an input or
        textarea so they never hijack a form.
      </div>
    </Modal>
  );
}
