import { useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { fromNow, formatInTz, tzAbbreviation } from '../utils/time';
import { usePreferences } from '../context/PreferencesContext';

interface RelativeTimeProps {
  value: string | Date;
  /** Show the absolute time as the visible label and the relative on hover. */
  inverted?: boolean;
  className?: string;
}

/**
 * RelativeTime — renders a relative timestamp ("2m ago") and shows the
 * absolute, time-zone-aware value on hover. The visible label re-renders
 * once a minute so it stays accurate without polling.
 */
export default function RelativeTime({ value, inverted, className }: RelativeTimeProps) {
  const { resolvedTimezone, timeFormat } = usePreferences();
  const fmt = timeFormat === '12h' ? 'MMM D, YYYY h:mm:ss A' : 'MMM D, YYYY HH:mm:ss';
  const absolute = `${formatInTz(value, resolvedTimezone, fmt)} (${tzAbbreviation(resolvedTimezone)})`;

  // Tick once a minute so "2m ago" -> "3m ago" without manual refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const relative = fromNow(value);

  return (
    <Tooltip title={inverted ? relative : absolute}>
      <span className={className ?? 'tabular-nums text-xs text-slate-500 dark:text-slate-400'}>
        {inverted ? absolute : relative}
      </span>
    </Tooltip>
  );
}
