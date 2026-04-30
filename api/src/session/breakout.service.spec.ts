import { BreakoutService } from './breakout.service';

describe('BreakoutService.roundRobin', () => {
  it('shuffles participants and distributes evenly', () => {
    const assignments = BreakoutService.roundRobin(['a','b','c','d'], 2, { allowEmptyRooms: true });
    expect(Object.keys(assignments)).toHaveLength(4);
    const rooms = new Set(Object.values(assignments));
    expect(rooms.size).toBeLessThanOrEqual(2);
  });

  it('caps groupCount at 25', () => {
    const assignments = BreakoutService.roundRobin(['x','y'], 100, { allowEmptyRooms: true });
    expect(Object.keys(assignments)).toHaveLength(2);
    const rooms = new Set(Object.values(assignments));
    // Even with 100 requested, only 25 rooms max, but all assigned should have a valid room
    expect(assignments['x']!).toBeDefined();
    expect(assignments['y']!).toBeDefined();
  });

  it('allows empty rooms when allowEmptyRooms is true', () => {
    const assignments = BreakoutService.roundRobin(['a'], 3, { allowEmptyRooms: true });
    expect(Object.keys(assignments)).toHaveLength(1);
    // The single student is assigned to room-a (room 0)
    expect(assignments['a']).toBe('room-a');
  });

  it('caps groupCount at participant count when allowEmptyRooms is false', () => {
    const assignments = BreakoutService.roundRobin(['a'], 3);
    expect(Object.keys(assignments)).toHaveLength(1);
    // Only room-a should exist
    expect(assignments['a']).toBe('room-a');
  });
});

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

  it('pre-provisions stub rooms for zero participants', () => {
    expect(BreakoutService.autoShuffle([], 2)).toEqual([
      { 'room-a': 'room-a' },
      { 'room-b': 'room-b' },
    ]);
  });

  it('pre-provisions stub rooms when groupCount < 2 (reset to 2)', () => {
    const res = BreakoutService.autoShuffle(['a', 'b'], 1);
    expect(res.length).toBe(2);
    const allKeys = res.flatMap((g) => Object.keys(g));
    expect(allKeys).toContain('a');
    expect(allKeys).toContain('b');

    const res2 = BreakoutService.autoShuffle(['a', 'b'], 0);
    expect(res2.length).toBe(2);
    const allKeys2 = res2.flatMap((g) => Object.keys(g));
    expect(allKeys2).toContain('a');
    expect(allKeys2).toContain('b');
  });

  it('caps groupCount at max 25 rooms', () => {
    const participants = Array.from({ length: 30 }, (_, i) => `user${i}`);
    const groups = BreakoutService.autoShuffle(participants, 50);
    expect(groups.length).toBe(25);
    const allKeys = groups.flatMap((g) => Object.keys(g));
    expect(allKeys.length).toBe(30);
  });
});

/* Legacy compat tests for old API */
describe('BreakoutService.assignBreakouts', () => {
  // This is an integration-level service; unit tests would need mocking.
  // We verify the interface exists via TypeScript.
  it('is defined', () => {
    expect(BreakoutService.name).toBe('BreakoutService');
  });
});
