import { Drawer, Button, Tag, Divider } from 'antd';
import {
  CopyOutlined,
  GlobalOutlined,
  UserOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import RelativeTime from './RelativeTime';
import CopyableId from './CopyableId';
import { copyText } from '../utils/clipboard';
import { useToastHistory } from '../context/ToastHistoryContext';

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string;
  created_at: string;
}

interface AuditDetailDrawerProps {
  open: boolean;
  entry: AuditLogRow | null;
  onClose: () => void;
  /**
   * Called with a partial filter object when the user clicks "Find similar
   * events". The parent page should pre-fill its filter bar accordingly.
   */
  onFindSimilar: (filters: {
    user_id?: string;
    action?: string;
    resource_type?: string;
  }) => void;
}

/** Coarse "geolocation" hint based purely on the IP shape. We don't ship
 *  a real GeoIP database in the browser; instead we surface useful structural
 *  hints (loopback, private range, IPv6) so admins can spot anomalies. */
function ipHint(ip: string | null): string {
  if (!ip) return 'unknown';
  if (ip === '127.0.0.1' || ip === '::1') return 'Loopback (server-internal)';
  if (/^10\./.test(ip)) return 'Private network (10.0.0.0/8)';
  if (/^192\.168\./.test(ip)) return 'Private network (192.168.0.0/16)';
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 'Private network (172.16.0.0/12)';
  if (ip.includes(':')) return 'IPv6 address';
  return 'Public IPv4';
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      <div className="text-sm text-slate-800 dark:text-slate-100">{children}</div>
    </div>
  );
}

/**
 * AuditDetailDrawer — slide-out detail view for a single audit log entry.
 *
 * Shows every field on the row plus an IP hint, a copy-as-JSON button, and
 * a "Find similar events" button that pre-fills the page's filter bar with
 * action/resource_type/user_id from this row.
 */
export default function AuditDetailDrawer({
  open,
  entry,
  onClose,
  onFindSimilar,
}: AuditDetailDrawerProps) {
  const { push } = useToastHistory();

  const copyJson = async () => {
    if (!entry) return;
    const ok = await copyText(JSON.stringify(entry, null, 2));
    push(ok ? 'success' : 'error', ok ? 'Copied row JSON.' : 'Copy failed.');
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Audit entry"
      width={460}
      destroyOnClose
      extra={
        <Button size="small" icon={<CopyOutlined />} onClick={copyJson}>
          Copy JSON
        </Button>
      }
    >
      {!entry ? null : (
        <div className="flex flex-col gap-5">
          <Field label="Action" icon={<AppstoreOutlined />}>
            <Tag
              color="cyan"
              style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 8px' }}
            >
              {entry.action}
            </Tag>
          </Field>

          <Field label="When" icon={<ClockCircleOutlined />}>
            <RelativeTime value={entry.created_at} inverted />
          </Field>

          <Field label="Resource">
            {entry.resource_type ? (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs">{entry.resource_type}</span>
                {entry.resource_id && (
                  <>
                    <span className="text-slate-400">·</span>
                    <CopyableId value={entry.resource_id} />
                  </>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </Field>

          <Field label="User" icon={<UserOutlined />}>
            <CopyableId value={entry.user_id} />
          </Field>

          <Field label="IP address" icon={<GlobalOutlined />}>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs">{entry.ip_address ?? '—'}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {ipHint(entry.ip_address)}
              </span>
            </div>
          </Field>

          <Field label="Audit row ID">
            <CopyableId value={entry.id} visibleChars={12} />
          </Field>

          <Divider className="!my-2" />

          <div className="flex flex-col gap-2">
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                onFindSimilar({
                  action: entry.action,
                  resource_type: entry.resource_type ?? undefined,
                });
                onClose();
              }}
            >
              Find similar events
            </Button>
            {entry.user_id && (
              <Button
                icon={<UserOutlined />}
                onClick={() => {
                  onFindSimilar({ user_id: entry.user_id ?? undefined });
                  onClose();
                }}
              >
                All events for this user
              </Button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
