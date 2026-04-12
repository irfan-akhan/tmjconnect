import { useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Input, Button, Alert } from 'antd';
import { SafetyCertificateOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import AuthShell from '../components/AuthShell';

export default function MfaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyMfa } = useAuth();
  const { defaultLanding } = usePreferences();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mfaToken = (location.state as { mfaToken?: string })?.mfaToken;
  if (!mfaToken) return <Navigate to="/login" replace />;

  const onSubmit = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      await verifyMfa(mfaToken, code);
      // Honour the admin's stored landing preference (Settings → Workflow).
      navigate(defaultLanding || '/', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Invalid code. Please try again.';
      setError(msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
          <SafetyCertificateOutlined style={{ fontSize: 28 }} />
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
          Two-factor authentication
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Verify it's you
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enter the 6-digit code from your authenticator app.
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

      <div className="flex flex-col items-center gap-6">
        <Input.OTP length={6} value={code} onChange={setCode} size="large" />

        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          disabled={code.length !== 6}
          onClick={onSubmit}
        >
          Verify and continue
        </Button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeftOutlined />
          Back to login
        </button>
      </div>
    </AuthShell>
  );
}
