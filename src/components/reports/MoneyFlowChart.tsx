'use client';

import { formatZAR } from '@/lib/currency';
import type { FlowLink } from '@/lib/reports/reports';

const COLOURS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16', '#f97316', '#64748b'];

/**
 * Where the money went: sources on the left flow into "Income" in the middle, then out
 * to categories on the right. Band widths are proportional to the amounts.
 */
export function MoneyFlowChart({ links }: { links: FlowLink[] }) {
  if (links.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No income or spending in this period</p>;
  const sources = links.filter((l) => l.to === 'Income');
  const targets = links.filter((l) => l.from === 'Income');
  const total = Math.max(sources.reduce((s, l) => s + l.amount, 0), targets.reduce((s, l) => s + l.amount, 0));
  const width = 640;
  const nodeW = 12;
  const gap = 6;
  const height = Math.max(260, Math.max(sources.length, targets.length) * 28);
  const usable = (n: number) => height - gap * Math.max(0, n - 1);
  const scaleLeft = usable(sources.length) / total;
  const scaleRight = usable(targets.length) / total;
  const midScale = height / total;

  let y = 0;
  const left = sources.map((l) => {
    const h = l.amount * scaleLeft;
    const node = { ...l, y, h };
    y += h + gap;
    return node;
  });
  y = 0;
  const right = targets.map((l) => {
    const h = l.amount * scaleRight;
    const node = { ...l, y, h };
    y += h + gap;
    return node;
  });

  const midX = width / 2 - nodeW / 2;
  const band = (x1: number, y1: number, h1: number, x2: number, y2: number, h2: number) => {
    const c = (x1 + x2) / 2;
    return `M${x1},${y1} C${c},${y1} ${c},${y2} ${x2},${y2} L${x2},${y2 + h2} C${c},${y2 + h2} ${c},${y1 + h1} ${x1},${y1 + h1} Z`;
  };

  let midIn = 0;
  let midOut = 0;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`-150 -4 ${width + 300} ${height + 8}`} className="w-full min-w-[640px]" role="img" aria-label="Where the money went">
        {left.map((n, i) => {
          const mh = n.amount * midScale;
          const path = band(nodeW, n.y, n.h, midX, midIn, mh);
          midIn += mh;
          return (
            <g key={`l${n.from}`}>
              <path d={path} fill={COLOURS[i % COLOURS.length]} opacity={0.35} />
              <rect x={0} y={n.y} width={nodeW} height={Math.max(1, n.h)} fill={COLOURS[i % COLOURS.length]} />
              <text x={-6} y={n.y + n.h / 2} textAnchor="end" dominantBaseline="middle" className="fill-foreground text-[11px]">
                {n.from} {formatZAR(n.amount)}
              </text>
            </g>
          );
        })}
        <rect x={midX} y={0} width={nodeW} height={height} className="fill-foreground" opacity={0.7} />
        {right.map((n, i) => {
          const mh = n.amount * midScale;
          const path = band(midX + nodeW, midOut, mh, width - nodeW, n.y, n.h);
          midOut += mh;
          const colour = n.to === 'Saved' ? '#10b981' : COLOURS[(i + 3) % COLOURS.length];
          return (
            <g key={`r${n.to}`}>
              <path d={path} fill={colour} opacity={0.35} />
              <rect x={width - nodeW} y={n.y} width={nodeW} height={Math.max(1, n.h)} fill={colour} />
              <text x={width + 6} y={n.y + n.h / 2} dominantBaseline="middle" className="fill-foreground text-[11px]">
                {n.to} {formatZAR(n.amount)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
