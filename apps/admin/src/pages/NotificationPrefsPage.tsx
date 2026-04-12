import { Progress, Tag } from 'antd';
import { MailOutlined, BellOutlined, WarningOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import { useNotifPrefsSummary } from '../hooks/todoQueries';

interface Summary {
  by_channel: {
    email_digest: { instant: number; daily: number; weekly: number; off: number };
    exercise_reminders: { on: number; off: number };
    symptom_checkin: { on: number; off: number };
    provider_messages: { on: number; off: number };
    report_updates: { on: number; off: number };
  };
  bounce_rate_24h: number;
}

function PreferenceBar({ label, on, off }: { label: string; on: number; off: number }) {
  const total = on + off;
  const percent = total > 0 ? Math.round((on / total) * 100) : 0;
  return (
    <div className="rounded-md border border-slate-100 p-3 dark:border-white/[0.06]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</div>
        <div className="text-xs text-slate-500">{on}/{total} enabled</div>
      </div>
      <div className="mt-2">
        <Progress percent={percent} size="small" strokeColor="#0D9488" />
      </div>
    </div>
  );
}

export default function NotificationPrefsPage() {
  const { data, isLoading } = useNotifPrefsSummary();
  const s: Summary = (data as Summary) ?? {
    by_channel: {
      email_digest: { instant: 0, daily: 0, weekly: 0, off: 0 },
      exercise_reminders: { on: 0, off: 0 },
      symptom_checkin: { on: 0, off: 0 },
      provider_messages: { on: 0, off: 0 },
      report_updates: { on: 0, off: 0 },
    },
    bounce_rate_24h: 0,
  };

  const totalDigest = s.by_channel.email_digest.instant + s.by_channel.email_digest.daily + s.by_channel.email_digest.weekly + s.by_channel.email_digest.off;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Notification preferences"
        subtitle="What users opted out of, and how email delivery is performing."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total users" value={isLoading ? '—' : totalDigest} icon={<BellOutlined />} tone="brand" />
        <KpiCard label="Digest: Off" value={isLoading ? '—' : s.by_channel.email_digest.off} icon={<MailOutlined />} tone="warning" hint="Opted out of email digest" />
        <KpiCard
          label="Bounce rate 24h"
          value={isLoading ? '—' : `${Math.round((s.bounce_rate_24h || 0) * 100)}%`}
          icon={<WarningOutlined />}
          tone={s.bounce_rate_24h > 0.1 ? 'danger' : s.bounce_rate_24h > 0.02 ? 'warning' : 'success'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Email digest frequency" subtitle="How users want the weekly summary">
          <div className="flex flex-col gap-2">
            {(['instant', 'daily', 'weekly', 'off'] as const).map((k) => {
              const count = s.by_channel.email_digest[k];
              return (
                <div key={k} className="flex items-center justify-between">
                  <Tag color={k === 'off' ? 'default' : k === 'instant' ? 'green' : 'blue'}>{k}</Tag>
                  <div className="flex items-center gap-2">
                    <Progress
                      percent={totalDigest > 0 ? Math.round((count / totalDigest) * 100) : 0}
                      size="small"
                      style={{ width: 160 }}
                      showInfo={false}
                    />
                    <span className="w-12 text-right tabular-nums text-xs text-slate-500">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Per-channel opt-in rates" subtitle="Users with each channel enabled">
          <div className="flex flex-col gap-3">
            <PreferenceBar label="Exercise reminders" on={s.by_channel.exercise_reminders.on} off={s.by_channel.exercise_reminders.off} />
            <PreferenceBar label="Symptom check-in" on={s.by_channel.symptom_checkin.on} off={s.by_channel.symptom_checkin.off} />
            <PreferenceBar label="Provider messages" on={s.by_channel.provider_messages.on} off={s.by_channel.provider_messages.off} />
            <PreferenceBar label="Report updates" on={s.by_channel.report_updates.on} off={s.by_channel.report_updates.off} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
