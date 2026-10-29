import {
  addDays,
  dayKeyOf,
  firstDayOfMonth,
  listDays,
  listMonths,
} from './analytics-day';

describe('dayKeyOf', () => {
  it('uses the London day, not the UTC day, during British summer time', () => {
    // 23:30 UTC on 24 Oct 2026 is 00:30 on 25 Oct in London (BST).
    expect(dayKeyOf(new Date('2026-10-24T23:30:00Z'))).toBe('2026-10-25');
  });

  it('keeps the previous day until London midnight', () => {
    expect(dayKeyOf(new Date('2026-10-24T22:59:59Z'))).toBe('2026-10-24');
  });

  it('uses GMT offsets in winter', () => {
    expect(dayKeyOf(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-15');
  });
});

describe('calendar helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('finds the first day of an earlier month', () => {
    expect(firstDayOfMonth('2026-10-26', 11)).toBe('2025-11-01');
  });

  it('lists days inclusively and is empty when reversed', () => {
    expect(listDays('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(listDays('2026-10-03', '2026-10-01')).toEqual([]);
  });

  it('lists months across a year boundary', () => {
    expect(listMonths('2025-11-15', '2026-01-03')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
});
