import { BreakoutService } from './breakout.service';

describe('BreakoutService.autoShuffle (static)', () => {
  it('caps groupCount at participant count to avoid empty rooms', () => {
    const participants = ['alice', 'bob'];
    const groups = BreakoutService.autoShuffle(participants, 6);
    expect(groups.length).toBe(2); // capped at 2 (participant count)
    const allKeys = groups.flatMap((g) => Object.keys(g));
    expect(allKeys).toContain('alice');
    expect(allKeys).toContain('bob');
    expect(allKeys).toHaveLength(2);
  });

  it('keeps requested group count when feasible', () => {
    const participants = ['a', 'b', 'c', 'd'];
    const groups = BreakoutService.autoShuffle(participants, 2);
    expect(groups.length).toBe(2);
    expect(Object.keys(groups[0]).length).toBe(2);
    expect(Object.keys(groups[1]).length).toBe(2);
  });

  it('returns empty array for zero participants', () => {
    expect(BreakoutService.autoShuffle([], 2)).toEqual([]);
  });

  it('returns empty array when groupCount < 2', () => {
    expect(BreakoutService.autoShuffle(['a', 'b'], 1)).toEqual([]);
    expect(BreakoutService.autoShuffle(['a', 'b'], 0)).toEqual([]);
  });

  it('caps groupCount at max 25 rooms', () => {
    const participants = Array.from({ length: 30 }, (_, i) => `user${i}`);
    const groups = BreakoutService.autoShuffle(participants, 50);
    expect(groups.length).toBe(25);
    const allKeys = groups.flatMap((g) => Object.keys(g));
    expect(allKeys.length).toBe(30);
  });
});
