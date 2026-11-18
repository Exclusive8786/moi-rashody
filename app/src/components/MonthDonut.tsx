import { formatMoney } from "../lib/money";
import type { CurrencyCode } from "../types";

export interface DonutSlice {
  name: string;
  color: string;
  total: number;
  share: number;
}

interface MonthDonutProps {
  total: number;
  slices: DonutSlice[];
  monthLabel: string;
  currency: CurrencyCode;
  onClick: () => void;
}

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

export function MonthDonut({ total, slices, monthLabel, currency, onClick }: MonthDonutProps) {
  let offset = 0;

  return (
    <button
      type="button"
      className="donut"
      onClick={onClick}
      aria-label={`Итог месяца ${monthLabel}: ${formatMoney(
        total,
        currency,
      )}. Открыть отчёт за этот месяц`}
    >
      <svg viewBox="0 0 120 120" className="donut-svg" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="12"
          className="donut-track"
        />
        {slices.map((slice) => {
          const length = total > 0 ? (slice.total / total) * CIRCUMFERENCE : 0;
          const dash = Math.max(length - (slices.length > 1 ? GAP : 0), 0.8);
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              key={slice.name}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth="12"
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
            />
          );
        })}
      </svg>
      <span className="donut-center">
        <span className="donut-sum">{formatMoney(total, currency)}</span>
        <span className="donut-label">{monthLabel}</span>
      </span>
    </button>
  );
}
