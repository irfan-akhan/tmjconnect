import { ResponsiveContainer, LineChart, Line, Tooltip as RechartsTooltip } from 'recharts';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  /** Show a hover tooltip with the value. */
  showTooltip?: boolean;
}

/**
 * Sparkline — minimal trend line for KPI tiles.
 *
 * No axes, no grid, no padding. Renders a 14-point series at 36px tall by
 * default which sits comfortably under a KpiCard value without competing
 * with it visually.
 */
export default function Sparkline({
  data,
  color = '#0D9488',
  height = 36,
  showTooltip = false,
}: SparklineProps) {
  if (!data || data.length === 0) return null;
  const series = data.map((v, i) => ({ i, v }));

  return (
    <div style={{ height, marginTop: 6 }}>
      <ResponsiveContainer>
        <LineChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          {showTooltip && (
            <RechartsTooltip
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '2 2' }}
              contentStyle={{
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: 6,
                fontSize: 11,
                padding: '4px 8px',
              }}
              labelFormatter={() => ''}
              formatter={(v) => [v, '']}
            />
          )}
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
