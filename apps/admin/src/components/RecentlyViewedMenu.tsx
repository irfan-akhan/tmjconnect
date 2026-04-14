import { Dropdown, Empty, Button } from 'antd';
import { ClockCircleOutlined, TeamOutlined, FileTextOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { usePreferences, type RecentEntity } from '../context/PreferencesContext';
import { fromNow } from '../utils/time';

function entityIcon(type: RecentEntity['type']) {
  return type === 'user' ? <TeamOutlined /> : <FileTextOutlined />;
}

/** Append `?focus=1` so the destination page knows to flash a highlight ring. */
function entityHref(e: RecentEntity): string {
  if (e.type === 'user') return `/users/${e.id}?focus=1`;
  return `/reports?focus=1`;
}

/**
 * RecentlyViewedMenu — topbar dropdown showing the last 8 entities the
 * admin opened. Falls back to an empty state when nothing has been viewed.
 */
export default function RecentlyViewedMenu() {
  const { recentlyViewed, clearRecentlyViewed } = usePreferences();

  return (
    <Dropdown
      placement="bottomRight"
      trigger={['click']}
      dropdownRender={() => (
        <div className="w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-popover dark:border-white/[0.06] dark:bg-slate-800">
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Recently viewed
            </span>
            {recentlyViewed.length > 0 && (
              <button
                type="button"
                onClick={clearRecentlyViewed}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Clear
              </button>
            )}
          </div>
          {recentlyViewed.length === 0 ? (
            <div className="py-6">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Nothing viewed yet
                  </span>
                }
              />
            </div>
          ) : (
            <ul className="flex flex-col">
              {recentlyViewed.map((e) => (
                <li key={`${e.type}-${e.id}`}>
                  <Link
                    to={entityHref(e)}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50"
                  >
                    <span className="text-slate-400">{entityIcon(e.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{e.label}</div>
                      {e.subtitle && (
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {e.subtitle}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                      {fromNow(e.visitedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    >
      <Button
        type="text"
        className="!flex h-9 w-9 items-center justify-center !p-0 text-slate-500 hover:!bg-slate-100 hover:!text-slate-900 dark:hover:!bg-slate-800 dark:hover:!text-slate-100"
        aria-label="Recently viewed"
      >
        <ClockCircleOutlined />
      </Button>
    </Dropdown>
  );
}
