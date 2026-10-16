import type { AntiCheatEvent } from '../../db/schema';
import {
  capabilityPoints,
  deriveIntegrityStatus,
  runningAverage,
  summarizeIntegrityEvents,
  toDisplayId,
} from './employer-submission.view';

const event = (type: string): AntiCheatEvent => ({
  type,
  taskId: null,
  occurredAt: '2026-10-01T00:00:00.000Z',
});

const detail = (score: number) => ({ score, rationale: '', evidence: '' });

describe('employer submission view', () => {
  describe('deriveIntegrityStatus', () => {
    it('is PENDING until grading has finished', () => {
      expect(deriveIntegrityStatus('PENDING', [])).toBe('PENDING');
      expect(deriveIntegrityStatus('GRADING', [event('idle')])).toBe('PENDING');
    });

    it('is CLEAN with no events', () => {
      expect(deriveIntegrityStatus('GRADED', [])).toBe('CLEAN');
    });

    it('is MINOR_FLAGS for a few events', () => {
      expect(deriveIntegrityStatus('GRADED', [event('idle')])).toBe(
        'MINOR_FLAGS',
      );
    });

    it('needs review for a stale heartbeat or many events', () => {
      expect(
        deriveIntegrityStatus('GRADED', [event('server-stale-heartbeat')]),
      ).toBe('REVIEW_NEEDED');
      expect(
        deriveIntegrityStatus(
          'GRADED',
          Array.from({ length: 6 }, () => event('tab-hidden')),
        ),
      ).toBe('REVIEW_NEEDED');
    });
  });

  it('summarizes events by type, most frequent first', () => {
    expect(
      summarizeIntegrityEvents([
        event('idle'),
        event('tab-hidden'),
        event('tab-hidden'),
      ]),
    ).toEqual([
      { type: 'tab-hidden', count: 2 },
      { type: 'idle', count: 1 },
    ]);
  });

  it('derives a display id from the submission id', () => {
    expect(toDisplayId('a1b2c3d4-0000-0000-0000-000000000000')).toBe(
      'GD-A1B2C3',
    );
  });

  it('scores capability from the three global categories only, out of 1000', () => {
    expect(
      capabilityPoints({
        problemSolving: detail(60),
        judgmentExecution: detail(90),
        writtenCommunication: detail(90),
        commercialDomainAwareness: detail(0),
      }),
    ).toBe(800);
  });

  it('averages applications equally as they accumulate', () => {
    expect(runningAverage([800, 600, 700])).toEqual([800, 700, 700]);
    expect(runningAverage([])).toEqual([]);
  });
});
