import { Drawer, Button, Empty } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  InfoCircleFilled,
  WarningFilled,
  ClearOutlined,
} from '@ant-design/icons';
import { useEffect } from 'react';
import { useToastHistory, type ToastLevel } from '../context/ToastHistoryContext';
import RelativeTime from './RelativeTime';

const levelStyle: Record<ToastLevel, { icon: React.ReactNode; color: string }> = {
  success: { icon: <CheckCircleFilled />, color: '#10B981' },
  info:    { icon: <InfoCircleFilled />,  color: '#3B82F6' },
  warning: { icon: <WarningFilled />,     color: '#F59E0B' },
  error:   { icon: <CloseCircleFilled />, color: '#EF4444' },
};

interface ToastHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ToastHistoryDrawer — slide-out panel listing the last 30 toasts emitted
 * across the session. Auto-marks all entries read on open so the unread
 * badge resets.
 */
export default function ToastHistoryDrawer({ open, onClose }: ToastHistoryDrawerProps) {
  const { history, clear, markAllRead } = useToastHistory();

  useEffect(() => {
    if (open) markAllRead();
  }, [open, markAllRead]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Notifications"
      width={400}
      extra={
        history.length > 0 && (
          <Button size="small" icon={<ClearOutlined />} onClick={clear}>
            Clear all
          </Button>
        )
      }
    >
      {history.length === 0 ? (
        <div className="py-12">
          <Empty description="No notifications yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((entry) => {
            const s = levelStyle[entry.level];
            return (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-md border border-slate-100 bg-white px-3 py-2.5 dark:border-white/[0.06] dark:bg-slate-800"
              >
                <span className="mt-0.5 text-base" style={{ color: s.color }}>
                  {s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {entry.text}
                  </div>
                  <div className="mt-0.5">
                    <RelativeTime value={entry.at} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
