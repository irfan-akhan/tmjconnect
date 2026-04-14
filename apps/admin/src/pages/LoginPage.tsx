import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Alert } from 'antd';
import { LockOutlined, MailOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await login(values.email, values.password);
      if (result.mfa_required && result.mfa_token) {
        navigate('/mfa', { state: { mfaToken: result.mfa_token } });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
          Sign in
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Welcome back
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enter your credentials to access the admin console.
        </p>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          className="mb-4"
          closable
          onClose={() => setError(null)}
        />
      )}

      <Form layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
        <Form.Item
          name="email"
          label={
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email address
            </span>
          }
          rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
        >
          <Input prefix={<MailOutlined className="text-slate-400" />} placeholder="you@clinic.com" size="large" />
        </Form.Item>

        <Form.Item
          name="password"
          label={
            <div className="flex w-full items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </span>
            </div>
          }
          rules={[{ required: true, message: 'Enter your password' }]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-slate-400" />}
            placeholder="••••••••"
            size="large"
          />
        </Form.Item>

        <Form.Item className="mb-0 mt-6">
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
            icon={<ArrowRightOutlined />}
            iconPosition="end"
          >
            Continue
          </Button>
        </Form.Item>
      </Form>

      <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Protected by MFA and HIPAA-grade access controls.
      </div>
    </AuthShell>
  );
}
