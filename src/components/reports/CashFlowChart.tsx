'use client';

import { formatZAR } from '@/lib/currency';
import type { CashFlowRow } from '@/lib/supabase/data';

/** Income and spending side by side for each period, with the net underneath. */
export function CashFlowChart({ rows, label, height = 220 }: { rows: CashFlowRow[]; label: (row: CashFlowRow) => string; height?: number }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>;
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expenses]));
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-max items-end gap-3 px-1" style={{ height }}>
        {rows.map((r) => (
          <div key={r.period_start} className="flex w-20 flex-col items-center" title={`${label(r)}: in ${formatZAR(r.income)}, out ${formatZAR(r.expenses)}, net ${formatZAR(r.net)}`}>
            <div className="flex w-full items-end justify-center gap-1" style={{ height: height - 44 }}>
              <div className="w-1/2 rounded-t bg-green-500" style={{ height: `${(r.income / max) * 100}%` }} />
              <div className="w-1/2 rounded-t bg-red-500" style={{ height: `${(r.expenses / max) * 100}%` }} />
            </div>
            <p className="mt-1 w-full truncate text-center text-xs text-muted-foreground">{label(r)}</p>
            <p className={`text-xs font-medium ${r.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.net >= 0 ? '+' : '-'}{formatZAR(Math.abs(r.net))}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" />Money in</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" />Money out</span>
      </div>
    </div>
  );
}
