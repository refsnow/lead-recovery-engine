/**
 * Minimal inline-SVG charts. Deliberately dependency-free — these render on the
 * server with no client JS, and no charting library is needed for the shapes
 * this product uses.
 */

export function TrendChart({
  data, height = 120,
}: { data: { date: string; total: number; hot: number }[]; height?: number }) {
  if (!data.length) return null;

  const max = Math.max(1, ...data.map((point) => point.total));
  const barWidth = 100 / data.length;

  return (
    <div className="px-4 pb-4 sm:px-5">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label={`Daily lead volume for the last ${data.length} days`}
      >
        {data.map((point, index) => {
          const totalHeight = (point.total / max) * (height - 16);
          const hotHeight = (point.hot / max) * (height - 16);
          const x = index * barWidth;
          return (
            <g key={point.date}>
              <rect
                x={x + barWidth * 0.18} y={height - totalHeight - 12}
                width={barWidth * 0.64} height={Math.max(totalHeight, point.total ? 1 : 0)}
                rx={0.8} className="animate-grow-height fill-brand-300"
                style={{ animationDelay: `${index * 35}ms`, transformOrigin: `0 ${height - 12}px` }}
              />
              <rect
                x={x + barWidth * 0.18} y={height - hotHeight - 12}
                width={barWidth * 0.64} height={Math.max(hotHeight, point.hot ? 1 : 0)}
                rx={0.8} className="animate-grow-height fill-rose-400"
                style={{ animationDelay: `${index * 35 + 60}ms`, transformOrigin: `0 ${height - 12}px` }}
              />
            </g>
          );
        })}
        <line x1="0" y1={height - 12} x2="100" y2={height - 12} className="stroke-ink-200" strokeWidth="0.4" />
      </svg>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
        <span>{formatDayLabel(data[0]!.date)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand-300" aria-hidden />All leads
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-rose-400" aria-hidden />Hot
          </span>
        </span>
        <span>{formatDayLabel(data[data.length - 1]!.date)}</span>
      </div>
    </div>
  );
}

function formatDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Horizontal comparison bars used across the reports pages. */
export function HorizontalBars({
  rows, formatValue,
}: {
  rows: { label: string; value: number; secondary?: string }[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink-700">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-ink-900">{formatValue(row.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="animate-grow-width h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
              style={{ ['--target' as string]: `${(row.value / max) * 100}%` }}
            />
          </div>
          {row.secondary ? <p className="mt-0.5 text-[11px] text-ink-400">{row.secondary}</p> : null}
        </li>
      ))}
    </ul>
  );
}
