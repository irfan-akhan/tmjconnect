import { useState } from 'react';
import { Tooltip } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { copyText } from '../utils/clipboard';
import { useToastHistory } from '../context/ToastHistoryContext';

interface CopyableIdProps {
  /** The full id (UUID, email, etc.) — never truncated when copied. */
  value: string | null | undefined;
  /** Length of the displayed prefix. Defaults to 8. */
  visibleChars?: number;
  /** Suffix shown after the prefix. Defaults to "…". */
  ellipsis?: string;
  className?: string;
  /** Hide the copy icon and only render the truncated label. */
  iconless?: boolean;
}

/**
 * CopyableId — renders a truncated id with a copy-to-clipboard icon button.
 *
 * Click anywhere on the chip to copy the full value. A 1.6s "copied" check
 * mark replaces the icon for visual confirmation. The full value is also
 * shown in a tooltip on hover.
 */
export default function CopyableId({
  value,
  visibleChars = 8,
  ellipsis = '…',
  className,
  iconless,
}: CopyableIdProps) {
  const { push } = useToastHistory();
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const display = value.length > visibleChars ? `${value.slice(0, visibleChars)}${ellipsis}` : value;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      push('success', `Copied ${value.slice(0, 12)}…`);
      setTimeout(() => setCopied(false), 1600);
    } else {
      push('error', 'Copy failed.');
    }
  };

  return (
    <Tooltip title={value}>
      <button
        type="button"
        onClick={handleCopy}
        className={
          className ??
          'group inline-flex items-center gap-1 rounded px-1 font-mono text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100'
        }
      >
        <span>{display}</span>
        {!iconless && (
          <span className="opacity-0 transition group-hover:opacity-100">
            {copied ? (
              <CheckOutlined style={{ fontSize: 11, color: '#10B981' }} />
            ) : (
              <CopyOutlined style={{ fontSize: 11 }} />
            )}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
