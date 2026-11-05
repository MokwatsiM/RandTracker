import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, moveItem, resizeItem, toggleItem, visibleLayout } from './layout';

const known = ['summary', 'coming-up', 'budget', 'cash-flow', 'recent', 'debt-free', 'spending', 'tfsa'].map((id) => ({ id, title: id, defaultSize: 'half' as const }));

describe('dashboard layout', () => {
  it('uses the default until one is saved, and drops unknown or repeated cards', () => {
    expect(visibleLayout(null, known)).toEqual(DEFAULT_LAYOUT);
    expect(visibleLayout([{ id: 'gone', size: 'half' }, { id: 'tfsa', size: 'full' }, { id: 'tfsa', size: 'half' }], known)).toEqual([{ id: 'tfsa', size: 'full' }]);
  });

  it('moves, adds, removes and resizes cards', () => {
    const layout = [{ id: 'a', size: 'half' as const }, { id: 'b', size: 'half' as const }];
    expect(moveItem(layout, 'b', -1).map((i) => i.id)).toEqual(['b', 'a']);
    expect(moveItem(layout, 'a', -1)).toBe(layout);
    expect(toggleItem(layout, { id: 'c', title: 'c', defaultSize: 'full' })).toEqual([...layout, { id: 'c', size: 'full' }]);
    expect(toggleItem(layout, { id: 'a', title: 'a', defaultSize: 'half' }).map((i) => i.id)).toEqual(['b']);
    expect(resizeItem(layout, 'a')[0].size).toBe('full');
  });
});
