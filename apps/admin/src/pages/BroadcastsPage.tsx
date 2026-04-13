import { useState, useMemo } from 'react';
import { Button, Modal, Form, Input, Select, Checkbox, DatePicker, Table, Tag } from 'antd';
import { NotificationOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import EmptyState from '../components/EmptyState';
import { useBroadcasts, useCreateBroadcast } from '../hooks/todoQueries';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useToastHistory } from '../context/ToastHistoryContext';

export default function BroadcastsPage() {
  const { push } = useToastHistory();
  const [composeOpen, setComposeOpen] = useState(false);
  const [form] = Form.useForm();

  const defaults = useMemo(() => ({ page: '1', limit: '20' }), []);
  const { filters, setFilter } = useUrlFilters(defaults);

  const { data: response, isLoading } = useBroadcasts({
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 20,
  });
  const items = response?.data ?? [];
  const meta = response?.meta ?? { page: 1, limit: 20, total: 0 };

  const createMut = useCreateBroadcast();

  const handleSend = async () => {
    try {
      const values = await form.validateFields();
      const result = await createMut.mutateAsync({
        ...values,
        scheduled_at: values.scheduled_at ? values.scheduled_at.toISOString() : null,
      });
      push('success', `Broadcast sent to ${result.data?.data?.recipient_count ?? '?'} recipients.`);
      form.resetFields();
      setComposeOpen(false);
    } catch (err) {
      if ((err as Record<string, unknown>)?.errorFields) return;
      push('error', 'Failed to send broadcast.');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Broadcasts"
        subtitle="Platform-wide announcements and system messages."
        actions={
          <Button type="primary" icon={<NotificationOutlined />} onClick={() => setComposeOpen(true)}>
            New broadcast
          </Button>
        }
      />

      <SectionCard title="History" subtitle={`${meta.total.toLocaleString()} past broadcasts`} flush>
        <Table
          rowKey="id"
          dataSource={items}
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
              title: 'Sent',
              dataIndex: 'sent_at',
              width: 140,
              render: (v: string | null, r: Record<string, unknown>) =>
                v ? <RelativeTime value={v} /> : r.scheduled_at ? (
                  <Tag color="blue">Scheduled {dayjs(r.scheduled_at as string).format('MMM D')}</Tag>
                ) : <Tag>Pending</Tag>,
            },
            {
              title: 'Title',
              dataIndex: 'title',
              render: (v: string, r: Record<string, unknown>) => (
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{v}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{r.body as string}</div>
                </div>
              ),
            },
            {
              title: 'Audience',
              dataIndex: 'audience',
              width: 110,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            {
              title: 'Type',
              dataIndex: 'type',
              width: 120,
              render: (v: string) => <Tag color={v === 'system' ? 'red' : 'cyan'}>{v}</Tag>,
            },
            {
              title: 'Channels',
              dataIndex: 'channels',
              width: 150,
              render: (v: string[]) => (
                <div className="flex gap-1">
                  {(v ?? []).map((c) => <Tag key={c} color="blue" style={{ fontSize: 10 }}>{c}</Tag>)}
                </div>
              ),
            },
            {
              title: 'Recipients',
              dataIndex: 'recipient_count',
              width: 100,
              render: (v: number) => <span className="tabular-nums font-semibold">{v}</span>,
            },
            {
              title: 'By',
              dataIndex: 'created_by_email',
              width: 180,
              render: (v: string) => <span className="text-xs text-slate-500">{v}</span>,
            },
          ]}
          locale={{ emptyText: <EmptyState title="No broadcasts yet" description="Send the first platform-wide announcement." /> }}
        />
      </SectionCard>

      <Modal
        open={composeOpen}
        onCancel={() => setComposeOpen(false)}
        onOk={handleSend}
        okText={<><SendOutlined /> Send</>}
        okButtonProps={{ loading: createMut.isPending }}
        title="New broadcast"
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ audience: 'all', type: 'announcement', channels: ['in_app'] }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, max: 255 }]}>
            <Input placeholder="E.g. Maintenance Saturday 2 AM" />
          </Form.Item>
          <Form.Item name="body" label="Body" rules={[{ required: true, max: 2000 }]}>
            <Input.TextArea rows={4} placeholder="The full message body..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="audience" label="Audience" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'all', label: 'All users' },
                  { value: 'patients', label: 'Patients only' },
                  { value: 'providers', label: 'Providers only' },
                  { value: 'admins', label: 'Admins only' },
                ]}
              />
            </Form.Item>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'announcement', label: 'Announcement' },
                  { value: 'system', label: 'System (critical)' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item name="channels" label="Channels" rules={[{ required: true, message: 'Pick at least one channel' }]}>
            <Checkbox.Group
              options={[
                { value: 'in_app', label: 'In-app notification' },
                { value: 'email', label: 'Email' },
              ]}
            />
          </Form.Item>
          <Form.Item name="scheduled_at" label="Schedule (optional)" extra="Leave empty to send immediately">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
