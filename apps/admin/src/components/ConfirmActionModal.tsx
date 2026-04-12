import { useState, type ReactNode } from 'react';
import { Modal, Input, Button } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';

interface DiffEntry {
  label: string;
  before: ReactNode;
  after: ReactNode;
}

interface ConfirmActionModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Side-by-side before/after rows shown above the confirmation field. */
  diff?: DiffEntry[];
  /** When set, the user must type this exact string to enable the OK button. */
  confirmText?: string;
  okText?: string;
  okDanger?: boolean;
  onOk: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * ConfirmActionModal — universal "are you sure" with optional diff + type-to-confirm.
 *
 * Shows a header + description, an optional `before → after` diff table, and
 * an optional confirmation input. The OK button is disabled until the typed
 * value exactly matches `confirmText` (case-sensitive).
 *
 * Use this for any destructive action where the antd `Modal.confirm` would
 * be too thin: deactivating a user, force-resetting MFA, role changes, etc.
 */
export default function ConfirmActionModal({
  open,
  title,
  description,
  diff,
  confirmText,
  okText = 'Confirm',
  okDanger = true,
  onOk,
  onCancel,
}: ConfirmActionModalProps) {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const armed = !confirmText || typed === confirmText;

  const handleOk = async () => {
    if (!armed) return;
    setSubmitting(true);
    try {
      await onOk();
      setTyped('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTyped('');
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleFilled style={{ color: okDanger ? '#E11D48' : '#F59E0B' }} />
          <span>{title}</span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={handleCancel}>Cancel</Button>
          <Button type="primary" danger={okDanger} disabled={!armed} loading={submitting} onClick={handleOk}>
            {okText}
          </Button>
        </div>
      }
      destroyOnClose
    >
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
      )}

      {diff && diff.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-white/[0.06]">
          <div className="grid grid-cols-[120px_1fr_1fr] bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <div>Field</div>
            <div>Before</div>
            <div>After</div>
          </div>
          {diff.map((d, idx) => (
            <div
              key={d.label}
              className={`grid grid-cols-[120px_1fr_1fr] items-center px-3 py-2 text-xs ${
                idx % 2
                  ? 'bg-white dark:bg-slate-900/40'
                  : 'bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <div className="font-semibold text-slate-700 dark:text-slate-200">{d.label}</div>
              <div className="text-rose-600 line-through opacity-80 dark:text-rose-400">{d.before}</div>
              <div className="font-medium text-emerald-700 dark:text-emerald-400">{d.after}</div>
            </div>
          ))}
        </div>
      )}

      {confirmText && (
        <div className="mt-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Type{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {confirmText}
            </code>{' '}
            to enable {okText}.
          </div>
          <Input
            className="mt-2"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
            autoFocus
          />
        </div>
      )}
    </Modal>
  );
}
