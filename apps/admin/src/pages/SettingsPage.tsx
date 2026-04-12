import { Select, Switch, Button, Tag, Spin } from 'antd';
import {
  SettingOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  LockOutlined,
  ApiOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { usePreferences, type Density, type TimeFormat } from '../context/PreferencesContext';
import { useThemeMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { tzAbbreviation } from '../utils/time';
import { useToastHistory } from '../context/ToastHistoryContext';
import { useAdminStats } from '../hooks/queries';

/** Curated time-zone options. Admin can also use 'system' to match the browser. */
const TZ_OPTIONS = [
  { label: 'System default', value: 'system' },
  { label: 'UTC', value: 'UTC' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'America/Denver', value: 'America/Denver' },
  { label: 'America/Chicago', value: 'America/Chicago' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Asia/Karachi', value: 'Asia/Karachi' },
  { label: 'Asia/Dubai', value: 'Asia/Dubai' },
  { label: 'Asia/Singapore', value: 'Asia/Singapore' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Australia/Sydney', value: 'Australia/Sydney' },
];

const LANDING_OPTIONS = [
  { label: 'Dashboard', value: '/' },
  { label: 'Users', value: '/users' },
  { label: 'Audit logs', value: '/audit-logs' },
  { label: 'Login events', value: '/login-events' },
  { label: 'Reports', value: '/reports' },
];

interface HealthInfo {
  ok: boolean;
  total_users?: number;
  api_url?: string;
  checked_at: string;
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: React.ReactNode;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 max-w-md">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export default function SettingsPage() {
  const {
    density,
    setDensity,
    timeFormat,
    setTimeFormat,
    timezone,
    setTimezone,
    resolvedTimezone,
    defaultLanding,
    setDefaultLanding,
    readOnly,
    setReadOnly,
    clearRecentlyViewed,
  } = usePreferences();
  const { mode, toggle: toggleTheme } = useThemeMode();
  const { user } = useAuth();
  const { push, clear: clearToasts } = useToastHistory();

  // Reuse the shared admin stats query — dashboard and settings share the
  // same cached response (staleTime: 60s), so navigating between the two
  // never fires a duplicate request. If it errors, we show "Unreachable".
  const statsQ = useAdminStats();
  const healthLoading = statsQ.isLoading;
  const health: HealthInfo = {
    ok: statsQ.isSuccess,
    total_users: statsQ.data?.total_users,
    api_url: import.meta.env.VITE_API_URL as string,
    checked_at: new Date().toISOString(),
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Personal preferences and system status. Stored on this browser."
      />

      {/* ─── Appearance ─────────────────────────────────────────────── */}
      <SectionCard
        title="Appearance"
        subtitle="How the console looks and feels"
        flush
        className="mb-6"
      >
        <SettingRow
          title="Theme"
          description="Light and dark are both first-class. Press 't' to toggle."
          control={
            <Select
              style={{ width: 180 }}
              value={mode}
              onChange={(v) => v !== mode && toggleTheme()}
              options={[
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ]}
            />
          }
        />
        <SettingRow
          title="Density"
          description="Compact fits more rows on screen at the cost of breathing room."
          control={
            <Select
              style={{ width: 180 }}
              value={density}
              onChange={(v: Density) => setDensity(v)}
              options={[
                { label: 'Comfortable', value: 'comfortable' },
                { label: 'Compact', value: 'compact' },
              ]}
            />
          }
        />
      </SectionCard>

      {/* ─── Locale ─────────────────────────────────────────────────── */}
      <SectionCard
        title="Locale"
        subtitle="How dates and times are rendered"
        flush
        className="mb-6"
      >
        <SettingRow
          title="Time zone"
          description={
            <>
              All timestamps render in this zone. Currently:{' '}
              <Tag color="cyan">
                {resolvedTimezone} · {tzAbbreviation(resolvedTimezone)}
              </Tag>
            </>
          }
          control={
            <Select
              style={{ width: 240 }}
              value={timezone}
              onChange={setTimezone}
              options={TZ_OPTIONS}
              showSearch
              optionFilterProp="label"
            />
          }
        />
        <SettingRow
          title="Time format"
          description="12-hour (8:00 AM) or 24-hour (08:00)."
          control={
            <Select
              style={{ width: 180 }}
              value={timeFormat}
              onChange={(v: TimeFormat) => setTimeFormat(v)}
              options={[
                { label: '12-hour', value: '12h' },
                { label: '24-hour', value: '24h' },
              ]}
            />
          }
        />
      </SectionCard>

      {/* ─── Workflow ───────────────────────────────────────────────── */}
      <SectionCard
        title="Workflow"
        subtitle="Defaults and safety nets"
        flush
        className="mb-6"
      >
        <SettingRow
          title="Default landing page"
          description="Where you start when you sign in or click the TMJConnect logo."
          control={
            <Select
              style={{ width: 200 }}
              value={defaultLanding}
              onChange={setDefaultLanding}
              options={LANDING_OPTIONS}
            />
          }
        />
        <SettingRow
          title="Read-only mode"
          description="Disables every mutating button across the app. Useful when you're just exploring."
          control={
            <Switch
              checked={readOnly}
              onChange={setReadOnly}
              checkedChildren={<LockOutlined />}
              unCheckedChildren={null}
            />
          }
        />
      </SectionCard>

      {/* ─── Local data ─────────────────────────────────────────────── */}
      <SectionCard
        title="Local data"
        subtitle="State that lives only in this browser"
        flush
        className="mb-6"
      >
        <SettingRow
          title="Recently viewed history"
          description="Last 8 entities you opened. Clearing removes them everywhere in the console."
          control={
            <Button
              danger
              onClick={() => {
                clearRecentlyViewed();
                push('success', 'Recently viewed cleared.');
              }}
            >
              Clear history
            </Button>
          }
        />
        <SettingRow
          title="Notification history"
          description="The last 30 toasts shown in the bell drawer."
          control={
            <Button
              danger
              onClick={() => {
                clearToasts();
                push('success', 'Notification history cleared.');
              }}
            >
              Clear toasts
            </Button>
          }
        />
      </SectionCard>

      {/* ─── System status ─────────────────────────────────────────── */}
      <SectionCard
        title="System status"
        subtitle="What this browser knows about the API"
        className="mb-6"
      >
        {healthLoading ? (
          <div className="py-6 text-center">
            <Spin />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatusTile
              icon={<ApiOutlined />}
              label="API endpoint"
              value={health?.api_url ?? '—'}
            />
            <StatusTile
              icon={health?.ok ? <CheckCircleFilled /> : <ExclamationCircleFilled />}
              label="API health"
              value={
                <span
                  className={
                    health?.ok ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'
                  }
                >
                  {health?.ok ? 'Reachable' : 'Unreachable'}
                </span>
              }
            />
            <StatusTile
              icon={<AppstoreOutlined />}
              label="Total users (live)"
              value={health?.total_users?.toLocaleString() ?? '—'}
            />
            <StatusTile
              icon={<ClockCircleOutlined />}
              label="Last checked"
              value={
                health
                  ? new Date(health.checked_at).toLocaleTimeString()
                  : '—'
              }
            />
            <StatusTile
              icon={<SettingOutlined />}
              label="Signed in as"
              value={user?.email ?? '—'}
            />
            <StatusTile
              icon={<LockOutlined />}
              label="Role"
              value="admin"
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StatusTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50 px-4 py-3 dark:border-white/[0.06] dark:bg-slate-900/40">
      <span className="text-base text-slate-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {value}
        </div>
      </div>
    </div>
  );
}
