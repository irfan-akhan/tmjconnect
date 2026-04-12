import { type ReactNode } from 'react';
import { Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

interface EmptyStateProps {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** Optional CTA — typically "Clear filters". */
  action?: { label: string; onClick: () => void };
}

/**
 * EmptyState — friendly placeholder for "no results" screens.
 *
 * The default antd Empty is functional but feels like a 404 page. This
 * variant gives the admin a clear next action ("Clear filters") so the
 * page never feels like a dead end.
 */
export default function EmptyState({
  title = 'Nothing to show',
  description = 'No matches with the current filters.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        {icon ?? <InboxOutlined />}
      </div>
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      <div className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{description}</div>
      {action && (
        <Button className="mt-4" type="primary" ghost onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
