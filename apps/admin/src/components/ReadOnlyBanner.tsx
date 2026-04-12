import { Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { usePreferences } from '../context/PreferencesContext';

/**
 * ReadOnlyBanner — sticky banner shown above page content whenever the
 * admin has flipped the read-only switch. Pages should additionally
 * disable mutating buttons via `usePreferences().readOnly` so the user
 * gets fast visual feedback that nothing will fire.
 */
export default function ReadOnlyBanner() {
  const { readOnly, setReadOnly } = usePreferences();
  if (!readOnly) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <LockOutlined />
        <span className="text-xs font-semibold">
          Read-only mode is on. Mutating actions are disabled across the app.
        </span>
      </div>
      <Button size="small" onClick={() => setReadOnly(false)}>
        Disable
      </Button>
    </div>
  );
}
