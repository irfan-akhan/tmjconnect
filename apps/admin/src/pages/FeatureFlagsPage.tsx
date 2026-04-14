import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, Tag, Popconfirm, Select, Tooltip } from 'antd';
import { FlagOutlined, DeleteOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import EmptyState from '../components/EmptyState';
import {
  useFeatureFlags, useCreateFeatureFlag, useUpdateFeatureFlag, useDeleteFeatureFlag,
} from '../hooks/todoQueries';
import { useToastHistory } from '../context/ToastHistoryContext';

interface Row {
  key: string;
  enabled: boolean;
  description: string | null;
  rollout_percent: number;
  target_roles: string[] | null;
  updated_at: string;
  updated_by_email: string | null;
}

export default function FeatureFlagsPage() {
  const { push } = useToastHistory();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useFeatureFlags();
  const flags = (data ?? []) as Row[];

  const createMut = useCreateFeatureFlag();
  const updateMut = useUpdateFeatureFlag();
  const deleteMut = useDeleteFeatureFlag();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createMut.mutateAsync(values);
      push('success', `Flag "${values.key}" created.`);
      form.resetFields();
      setModalOpen(false);
    } catch (err) {
      if ((err as Record<string, unknown>)?.errorFields) return;
      push('error', 'Failed to create flag.');
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteMut.mutateAsync(key);
      push('success', 'Flag deleted.');
    } catch {
      push('error', 'Delete failed.');
    }
  };

  const handleToggle = async (key: string, enabled: boolean) => {
    try {
      await updateMut.mutateAsync({ key, enabled });
      push('success', enabled ? 'Flag enabled.' : 'Flag disabled.');
    } catch {
      push('error', 'Update failed.');
    }
  };

  const handleRollout = async (key: string, rollout_percent: number) => {
    try {
      await updateMut.mutateAsync({ key, rollout_percent });
      push('success', `Rollout set to ${rollout_percent}%.`);
    } catch {
      push('error', 'Update failed.');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Feature flags"
        subtitle="Gradual rollouts and kill switches."
        actions={
          <Button type="primary" icon={<FlagOutlined />} onClick={() => setModalOpen(true)}>
            New flag
          </Button>
        }
      />

      <SectionCard title="All flags" subtitle={`${flags.length} flag${flags.length === 1 ? '' : 's'}`} flush>
        <Table<Row>
          rowKey="key"
          dataSource={flags}
          loading={isLoading}
          sticky
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: 'Key',
              dataIndex: 'key',
              render: (v: string, r: Row) => (
                <div>
                  <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{v}</div>
                  {r.description && <div className="text-xs text-slate-500 dark:text-slate-400">{r.description}</div>}
                </div>
              ),
            },
            {
              title: 'Enabled',
              dataIndex: 'enabled',
              width: 100,
              render: (v: boolean, r: Row) => (
                <Switch checked={v} onChange={(c) => handleToggle(r.key, c)} size="small" />
              ),
            },
            {
              title: 'Rollout %',
              dataIndex: 'rollout_percent',
              width: 160,
              render: (v: number, r: Row) => (
                <InputNumber
                  size="small"
                  min={0}
                  max={100}
                  value={v}
                  style={{ width: 90 }}
                  onBlur={(e) => {
                    const next = parseInt(e.target.value, 10);
                    if (!isNaN(next) && next !== v) handleRollout(r.key, next);
                  }}
                  suffix="%"
                />
              ),
            },
            {
              title: 'Target roles',
              dataIndex: 'target_roles',
              width: 200,
              render: (v: string[] | null) =>
                !v || v.length === 0 ? <Tag>all roles</Tag> : (
                  <div className="flex gap-1">
                    {v.map((r) => <Tag key={r} color="cyan">{r}</Tag>)}
                  </div>
                ),
            },
            {
              title: 'Updated',
              dataIndex: 'updated_at',
              width: 140,
              render: (v: string, r: Row) => (
                <div>
                  <RelativeTime value={v} />
                  {r.updated_by_email && (
                    <div className="text-[11px] text-slate-500">by {r.updated_by_email.split('@')[0]}</div>
                  )}
                </div>
              ),
            },
            {
              title: '',
              key: 'actions',
              width: 60,
              align: 'right',
              render: (_: unknown, r: Row) => (
                <Popconfirm title={`Delete "${r.key}"?`} onConfirm={() => handleDelete(r.key)}>
                  <Tooltip title="Delete">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              ),
            },
          ]}
          locale={{ emptyText: <EmptyState title="No feature flags" description="Create a flag to gate features." /> }}
        />
      </SectionCard>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="Create"
        okButtonProps={{ loading: createMut.isPending }}
        title="New feature flag"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: false, rollout_percent: 0 }}>
          <Form.Item
            name="key"
            label="Key"
            rules={[
              { required: true },
              { pattern: /^[a-z0-9_]+$/, message: 'Lowercase, digits, underscores only' },
              { max: 100 },
            ]}
            extra="Used as the lookup key in code"
          >
            <Input placeholder="e.g. new_dashboard" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ max: 500 }]}>
            <Input.TextArea rows={2} placeholder="What does this flag control?" />
          </Form.Item>
          <Form.Item name="enabled" label="Start enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="rollout_percent" label="Rollout percent" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} suffix="%" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="target_roles" label="Target roles (optional)">
            <Select
              mode="multiple"
              placeholder="Leave empty for all roles"
              options={[
                { value: 'patient', label: 'Patient' },
                { value: 'provider', label: 'Provider' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
