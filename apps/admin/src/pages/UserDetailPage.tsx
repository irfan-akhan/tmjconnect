import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Tabs,
  Table,
  Spin,
  Alert,
  Button,
  Avatar,
} from 'antd';
import {
  ArrowLeftOutlined,
  StopOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  LockOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  HeartOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import CopyableId from '../components/CopyableId';
import EmptyState from '../components/EmptyState';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { roleColors } from '../theme/tokens';
import { usePreferences } from '../context/PreferencesContext';
import { useToastHistory } from '../context/ToastHistoryContext';
import { useAdminUserDetail, queryKeys } from '../hooks/queries';

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3 dark:border-white/[0.06] dark:bg-slate-900/40">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  );
}

type ConfirmKind = 'toggle' | 'force-pwd' | 'force-mfa' | null;

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { recordVisit, readOnly } = usePreferences();
  const { push } = useToastHistory();
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);

  const [searchParams] = useSearchParams();
  const [flashing, setFlashing] = useState(searchParams.get('focus') === '1');
  useEffect(() => {
    if (!flashing) return;
    const t = setTimeout(() => setFlashing(false), 1500);
    return () => clearTimeout(t);
  }, [flashing]);

  const { data: detail, isLoading, error } = useAdminUserDetail(id);

  // Record visit for the "recently viewed" panel.
  useEffect(() => {
    if (!detail) return;
    const u = detail.user;
    const fullName =
      [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email.split('@')[0];
    recordVisit({ type: 'user', id: u.id, label: fullName, subtitle: u.email });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.user.id]);

  const updateUser = async (fields: Record<string, boolean | string>) => {
    try {
      await api.patch(`/admin/users/${id}`, fields);
      push('success', 'User updated.');
      queryClient.invalidateQueries({ queryKey: queryKeys.userDetail(id ?? '') });
    } catch {
      push('error', 'Failed to update user.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }
  if (error || !detail) return <Alert type="error" message="User not found." showIcon />;

  const u = detail.user;
  const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email.split('@')[0];
  const initials =
    (u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? '') || u.email.slice(0, 2).toUpperCase();
  const role = roleColors[u.role];

  const eyebrow =
    u.role === 'patient' ? 'Patient' : u.role === 'provider' ? 'Provider' : 'Admin';
  const eyebrowIcon =
    u.role === 'patient' ? <HeartOutlined /> : u.role === 'provider' ? <MedicineBoxOutlined /> : <LockOutlined />;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/users')}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:hover:text-slate-100"
      >
        <ArrowLeftOutlined />
        Back to Users
      </button>

      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            {eyebrowIcon}
            {eyebrow}
          </span>
        }
        title={fullName}
        subtitle={u.email}
      />

      {/* ─── Identity card ─────────────────────────────────────────────── */}
      <SectionCard className={`mb-6 ${flashing ? 'flash-focus' : ''}`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex items-center gap-4">
            <Avatar
              size={72}
              style={{
                background: role.bg,
                color: role.text,
                fontWeight: 600,
                fontSize: 24,
                border: `2px solid ${role.border}`,
              }}
            >
              {initials.toUpperCase()}
            </Avatar>
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{fullName}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{u.email}</div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ background: role.bg, color: role.text, borderColor: role.border }}
                >
                  {u.role}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  />
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Button
              danger={u.is_active}
              disabled={readOnly}
              icon={u.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={() => setConfirmKind('toggle')}
            >
              {u.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              icon={<KeyOutlined />}
              disabled={readOnly}
              onClick={() => setConfirmKind('force-pwd')}
            >
              Force password reset
            </Button>
            {u.mfa_enabled && (
              <Button
                icon={<LockOutlined />}
                disabled={readOnly}
                onClick={() => setConfirmKind('force-mfa')}
              >
                Force MFA reset
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <InfoTile label="Role" value={u.role.toUpperCase()} />
          <InfoTile
            label="Email verified"
            value={u.email_verified ? 'Yes' : <span className="text-rose-600">No</span>}
          />
          <InfoTile label="MFA" value={u.mfa_enabled ? 'Enabled' : 'Off'} />
          <InfoTile label="Timezone" value={u.timezone ?? '—'} />
          <InfoTile label="Joined" value={<RelativeTime value={u.created_at} inverted />} />
          <InfoTile label="User ID" value={<CopyableId value={u.id} />} />
        </div>
      </SectionCard>

      {/* ─── Activity tabs ─────────────────────────────────────────────── */}
      <SectionCard flush>
        <Tabs
          defaultActiveKey="audit"
          tabBarStyle={{ padding: '0 20px', margin: 0 }}
          items={[
            {
              key: 'audit',
              label: 'Recent activity',
              children: (
                <div className="px-2 pb-4">
                  <Table
                    rowKey="id"
                    size="middle"
                    dataSource={detail.recent_audit_logs.items}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <EmptyState
                          title="No recent activity"
                          description="Audit entries will appear here as the user takes actions."
                        />
                      ),
                    }}
                    columns={[
                      {
                        title: 'Action',
                        dataIndex: 'action',
                        key: 'action',
                        render: (v: string) => (
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {v}
                          </span>
                        ),
                      },
                      {
                        title: 'Resource',
                        dataIndex: 'resource_type',
                        key: 'resource_type',
                        render: (v: string) =>
                          v ? (
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v}</span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          ),
                      },
                      {
                        title: 'When',
                        dataIndex: 'created_at',
                        key: 'created_at',
                        width: 180,
                        render: (v: string) => <RelativeTime value={v} />,
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'logins',
              label: 'Login events',
              children: (
                <div className="px-2 pb-4">
                  <Table
                    rowKey="id"
                    size="middle"
                    dataSource={detail.recent_login_events.items}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <EmptyState
                          title="No recent login events"
                          description="Authentication attempts will appear here."
                        />
                      ),
                    }}
                    columns={[
                      {
                        title: 'Status',
                        dataIndex: 'success',
                        key: 'success',
                        width: 120,
                        render: (v: boolean) =>
                          v ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <CheckCircleFilled style={{ color: '#10B981' }} />
                              Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                              <CloseCircleFilled style={{ color: '#EF4444' }} />
                              Failed
                            </span>
                          ),
                      },
                      {
                        title: 'IP',
                        dataIndex: 'ip_address',
                        key: 'ip',
                        render: (v: string) => (
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v ?? '—'}</span>
                        ),
                      },
                      {
                        title: 'Device',
                        dataIndex: 'device_info',
                        key: 'device',
                        ellipsis: true,
                        render: (v: string) => (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{v ?? '—'}</span>
                        ),
                      },
                      {
                        title: 'When',
                        dataIndex: 'created_at',
                        key: 'created_at',
                        width: 180,
                        render: (v: string) => <RelativeTime value={v} />,
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </SectionCard>

      {/* ─── Confirm modals ─────────────────────────────────────────────── */}
      <ConfirmActionModal
        open={confirmKind === 'toggle'}
        title={u.is_active ? 'Deactivate this user?' : 'Activate this user?'}
        description={
          u.is_active
            ? 'The user will no longer be able to log in. Their data is preserved.'
            : 'The user will be able to log in again immediately.'
        }
        diff={[
          { label: 'Email', before: u.email, after: u.email },
          {
            label: 'Status',
            before: u.is_active ? 'Active' : 'Inactive',
            after: u.is_active ? 'Inactive' : 'Active',
          },
        ]}
        confirmText={u.is_active ? 'DEACTIVATE' : undefined}
        okText={u.is_active ? 'Deactivate' : 'Activate'}
        okDanger={u.is_active}
        onOk={async () => {
          await updateUser({ is_active: !u.is_active });
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmActionModal
        open={confirmKind === 'force-pwd'}
        title="Force password reset?"
        description="The user will be required to reset their password on next login."
        confirmText="RESET"
        okText="Force reset"
        onOk={async () => {
          await updateUser({ force_password_reset: true });
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmActionModal
        open={confirmKind === 'force-mfa'}
        title="Force MFA reset?"
        description="The user will need to re-enrol in MFA on next login."
        confirmText="RESET MFA"
        okText="Force MFA reset"
        onOk={async () => {
          await updateUser({ force_mfa_reset: true });
          setConfirmKind(null);
        }}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  );
}
