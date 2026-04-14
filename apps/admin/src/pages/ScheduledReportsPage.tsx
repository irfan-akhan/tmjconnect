import { useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, Switch, Tooltip } from 'antd';
import { ScheduleOutlined, DeleteOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import EmptyState from '../components/EmptyState';
import {
  useScheduledReports, useCreateScheduledReport,
  useUpdateScheduledReport, useDeleteScheduledReport,
} from '../hooks/todoQueries';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useToastHistory } from '../context/ToastHistoryContext';

interface Row {
  id: string;
  name: string;
  entity: string;
  filters: Record<string, unknown>;
  cadence: string;
  recipient_emails: string[];
  next_run_at: string;
  last_run_at: string | null;
  enabled: boolean;
  created_by_email: string;
}

export default function ScheduledReportsPage() {
  const { push } = useToastHistory();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const defaults = useMemo(() => ({ page: '1', limit: '20' }), []);
  const { filters, setFilter } = useUrlFilters(defaults);

  const { data: response, isLoading } = useScheduledReports({
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 20,
  });
  const data = (response?.data ?? []) as Row[];
  const meta = response?.meta ?? { page: 1, limit: 20, total: 0 };

  const createMut = useCreateScheduledReport();
  const updateMut = useUpdateScheduledReport();
  const deleteMut = useDeleteScheduledReport();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createMut.mutateAsync({
        ...values,
        recipient_emails: values.recipient_emails.split(',').map((e: string) => e.trim()),
        filters: {},
      });
      push('success', 'Scheduled report created.');
      form.resetFields();
      setModalOpen(false);
    } catch (err) {
      if ((err as Record<string, unknown>)?.errorFields) return;
      push('error', 'Failed to create.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      push('success', 'Deleted.');
    } catch {
      push('error', 'Delete failed.');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateMut.mutateAsync({ id, enabled });
      push('success', enabled ? 'Enabled.' : 'Paused.');
    } catch {
      push('error', 'Update failed.');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Scheduled reports"
        subtitle="Recurring CSV exports delivered to inboxes."
        actions={
          <Button type="primary" icon={<ScheduleOutlined />} onClick={() => setModalOpen(true)}>
            New schedule
          </Button>
        }
      />

      <SectionCard title="All schedules" subtitle={`${meta.total.toLocaleString()} active and paused`} flush>
        <Table<Row>
          rowKey="id"
          dataSource={data}
          loading={isLoading}
          sticky
          scroll={{ x: 'max-content' }}
          pagination={{
            current: meta.page,
            pageSize: meta.limit,
            total: meta.total,
            onChange: (page, limit) => {
              setFilter('page', String(page));
              setFilter('limit', String(limit));
            },
            style: { padding: '16px 20px', margin: 0 },
          }}
          columns={[
            {
              title: 'Name',
              dataIndex: 'name',
              render: (v: string, r: Row) => (
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{v}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <Tag color="blue" style={{ marginRight: 4 }}>{r.entity}</Tag>
                    <Tag color="cyan">{r.cadence}</Tag>
                  </div>
                </div>
              ),
            },
            {
              title: 'Recipients',
              dataIndex: 'recipient_emails',
              render: (v: string[]) => (
                <div className="text-xs">
                  {v.slice(0, 2).join(', ')}
                  {v.length > 2 && <span className="text-slate-400"> +{v.length - 2} more</span>}
                </div>
              ),
            },
            {
              title: 'Next run',
              dataIndex: 'next_run_at',
              width: 150,
              render: (v: string, r: Row) =>
                r.enabled ? <RelativeTime value={v} /> : <Tag>Paused</Tag>,
            },
            {
              title: 'Last run',
              dataIndex: 'last_run_at',
              width: 150,
              render: (v: string | null) => v ? <RelativeTime value={v} /> : <span className="text-xs text-slate-400">Never</span>,
            },
            {
              title: 'Enabled',
              dataIndex: 'enabled',
              width: 100,
              render: (v: boolean, r: Row) => (
                <Switch checked={v} onChange={(c) => handleToggle(r.id, c)} size="small" />
              ),
            },
            {
              title: 'Created by',
              dataIndex: 'created_by_email',
              width: 180,
              render: (v: string) => <span className="text-xs text-slate-500">{v}</span>,
            },
            {
              title: '',
              key: 'actions',
              width: 80,
              align: 'right',
              render: (_: unknown, r: Row) => (
                <Popconfirm title="Delete this schedule?" onConfirm={() => handleDelete(r.id)}>
                  <Tooltip title="Delete">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              ),
            },
          ]}
          locale={{ emptyText: <EmptyState title="No scheduled reports" description="Create a recurring CSV export." /> }}
        />
      </SectionCard>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="Create"
        okButtonProps={{ loading: createMut.isPending }}
        title="New scheduled report"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ cadence: 'weekly', entity: 'audit_logs' }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, max: 200 }]}>
            <Input placeholder="e.g. Weekly audit log" />
          </Form.Item>
          <Form.Item name="entity" label="Entity" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'audit_logs', label: 'Audit logs' },
                { value: 'login_events', label: 'Login events' },
                { value: 'users', label: 'Users' },
                { value: 'reports', label: 'Reports' },
              ]}
            />
          </Form.Item>
          <Form.Item name="cadence" label="Cadence" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly (Monday)' },
                { value: 'monthly', label: 'Monthly (1st)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="recipient_emails" label="Recipient emails" rules={[{ required: true }]} extra="Comma-separated">
            <Input placeholder="alice@clinic.com, bob@clinic.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
