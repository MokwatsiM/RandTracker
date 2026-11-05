export type WidgetSize = 'half' | 'full';

export interface LayoutItem {
  id: string;
  size: WidgetSize;
}

export interface WidgetInfo {
  id: string;
  title: string;
  defaultSize: WidgetSize;
}

/** The layout a new user sees, and what "Reset" goes back to. */
export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: 'summary', size: 'full' },
  { id: 'coming-up', size: 'half' },
  { id: 'budget', size: 'half' },
  { id: 'cash-flow', size: 'half' },
  { id: 'recent', size: 'half' },
  { id: 'debt-free', size: 'half' },
  { id: 'spending', size: 'half' },
];

/**
 * The cards to show, in order. Cards the app no longer has are dropped, so an old saved
 * layout still works; cards it doesn't mention stay hidden until the user adds them.
 */
export function visibleLayout(saved: LayoutItem[] | null | undefined, known: WidgetInfo[]): LayoutItem[] {
  const ids = new Set(known.map((w) => w.id));
  const seen = new Set<string>();
  return (saved ?? DEFAULT_LAYOUT).filter((item) => {
    if (!ids.has(item.id) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function moveItem(layout: LayoutItem[], id: string, by: -1 | 1): LayoutItem[] {
  const index = layout.findIndex((item) => item.id === id);
  const target = index + by;
  if (index < 0 || target < 0 || target >= layout.length) return layout;
  const next = [...layout];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function toggleItem(layout: LayoutItem[], widget: WidgetInfo): LayoutItem[] {
  return layout.some((item) => item.id === widget.id)
    ? layout.filter((item) => item.id !== widget.id)
    : [...layout, { id: widget.id, size: widget.defaultSize }];
}

export function resizeItem(layout: LayoutItem[], id: string): LayoutItem[] {
  return layout.map((item) => (item.id === id ? { ...item, size: item.size === 'half' ? 'full' : 'half' } : item));
}
