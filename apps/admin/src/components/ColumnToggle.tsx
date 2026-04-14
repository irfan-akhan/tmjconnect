import { Popover, Checkbox, Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

interface ColumnToggleProps {
  columns: { key: string; label: string }[];
  isVisible: (key: string) => boolean;
  toggle: (key: string) => void;
  reset: () => void;
}

/**
 * ColumnToggle — popover with a checkbox per table column. Lets admins
 * hide/show columns without needing a Settings page visit. The selection
 * persists in localStorage via `useColumnVisibility`.
 */
export default function ColumnToggle({ columns, isVisible, toggle, reset }: ColumnToggleProps) {
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      title={
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Columns</span>
          <Button type="link" size="small" onClick={reset}>
            Show all
          </Button>
        </div>
      }
      content={
        <div className="flex flex-col gap-1.5" style={{ minWidth: 180 }}>
          {columns.map((c) => (
            <Checkbox
              key={c.key}
              checked={isVisible(c.key)}
              onChange={() => toggle(c.key)}
            >
              <span className="text-xs text-slate-700 dark:text-slate-200">{c.label}</span>
            </Checkbox>
          ))}
        </div>
      }
    >
      <Button size="small" icon={<SettingOutlined />} type="text">
        Columns
      </Button>
    </Popover>
  );
}
