import type { AntiCheatEvent } from '../../db/schema';
import { InterfaceType } from '../generation/roles/interface-type';
import {
  buildEmployerTaskResults,
  CAPABILITY_HALF_LIFE_DAYS,
  capabilityPoints,
  capabilityScoreHistory,
  deriveIntegrityStatus,
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

  describe('capabilityScoreHistory', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const at = (days: number, points: number) => ({
      points,
      completedAt: new Date(Date.UTC(2026, 0, 1) + days * DAY_MS),
    });

    it('returns an empty history for no applications', () => {
      expect(capabilityScoreHistory([])).toEqual([]);
    });

    it('dampens a single application toward the prior', () => {
      // (2 * 500 + 1 * 900) / (2 + 1)
      expect(capabilityScoreHistory([at(0, 900)])).toEqual([633]);
    });

    it('weighs applications completed at the same time equally', () => {
      // (1000 + 600) / 3, (1000 + 600 + 800) / 4, (1000 + 600 + 800 + 700) / 5
      expect(
        capabilityScoreHistory([at(0, 600), at(0, 800), at(0, 700)]),
      ).toEqual([533, 600, 620]);
    });

    it('weighs an application half as much after one half-life', () => {
      // Older weight 0.5, newer weight 1: (1000 + 0.5 * 400) / 3, then (1000 + 0.5 * 400 + 1000) / 3.5
      expect(
        capabilityScoreHistory([
          at(0, 400),
          at(CAPABILITY_HALF_LIFE_DAYS, 1000),
        ]),
      ).toEqual([467, 629]);
    });
  });

  describe('buildEmployerTaskResults', () => {
    const textTask = {
      interfaceType: InterfaceType.TEXT_AREA,
      interfacePayload: { interfaceType: 'TEXT_AREA', placeholder: null },
      objectiveComponent: null,
    };
    const tasks = [
      { id: 't1', title: 'First', questionPrompt: 'Do one', ...textTask },
      { id: 't2', title: 'Second', questionPrompt: 'Do two', ...textTask },
    ];
    const answers = [
      {
        taskId: 't1',
        responseBody: 'my answer',
        objectiveResponse: null,
        textResponse: 'my answer',
        timeSpentSeconds: 10,
      },
    ];

    it('lists every task with its structured answer and no grade when nothing was graded', () => {
      expect(buildEmployerTaskResults(tasks, answers, null, null)).toEqual([
        {
          taskId: 't1',
          taskNumber: 1,
          title: 'First',
          questionPrompt: 'Do one',
          ...textTask,
          answer: { objectiveResponse: null, textResponse: 'my answer' },
          score: null,
          evidence: null,
          checklist: null,
          gateTriggered: null,
        },
        {
          taskId: 't2',
          taskNumber: 2,
          title: 'Second',
          questionPrompt: 'Do two',
          ...textTask,
          answer: null,
          score: null,
          evidence: null,
          checklist: null,
          gateTriggered: null,
        },
      ]);
    });

    it('adds the score and summary for a graded task', () => {
      const graded = {
        taskId: 't1',
        questionBankId: 'q1',
        summary: 'You did well.',
        categoryScores: {
          problemSolving: detail(80),
          judgmentExecution: detail(60),
          writtenCommunication: detail(70),
          commercialDomainAwareness: detail(90),
        },
      };
      const [first, second] = buildEmployerTaskResults(
        tasks,
        answers,
        [graded],
        'SHE_HER',
      );
      expect(first.score).toBe(75);
      expect(first.evidence).toBe('She did well.');
      expect(second.score).toBeNull();
    });
  });
});
