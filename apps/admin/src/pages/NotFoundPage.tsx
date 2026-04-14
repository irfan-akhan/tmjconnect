import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, CompassOutlined } from '@ant-design/icons';
import { usePreferences } from '../context/PreferencesContext';

/**
 * NotFoundPage — friendly 404 with three exit ramps:
 *   - Back (history.back())
 *   - Home (admin's preferred default landing)
 *   - Open command palette (so they can search for what they wanted)
 *
 * Sits inside the AdminLayout so the topbar / sidebar are still available.
 */
export default function NotFoundPage() {
  const navigate = useNavigate();
  const { defaultLanding } = usePreferences();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
        <CompassOutlined style={{ fontSize: 36 }} />
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
        404 · Not found
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Nothing to see here
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
        The URL you followed doesn't match any page in the admin console. It might
        have moved, been deleted, or never existed.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Button
          type="primary"
          icon={<HomeOutlined />}
          onClick={() => navigate(defaultLanding || '/')}
        >
          Take me home
        </Button>
      </div>

      <div className="mt-10 text-[11px] text-slate-400 dark:text-slate-500">
        Tip: press{' '}
        <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
          ⌘K
        </kbd>{' '}
        anywhere to jump to a page or run an action.
      </div>
    </div>
  );
}
