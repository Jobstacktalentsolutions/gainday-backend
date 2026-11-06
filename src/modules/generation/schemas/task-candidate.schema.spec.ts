import { plannedSimulationSchema } from './task-candidate.schema';

describe('plannedSimulationSchema', () => {
  const allowedKeys: [string, ...string[]] = [
    'TYPE_A',
    'TYPE_B',
    'TYPE_C',
    'TYPE_D',
    'TYPE_E',
  ];
  const schema = plannedSimulationSchema(allowedKeys);

  it('validates a plan with 4 unique taskTypes successfully', () => {
    const validData = {
      candidates: [
        {
          candidateId: 'cand-1',
          taskType: 'TYPE_A',
          briefDescription: 'Tests skill A',
        },
        {
          candidateId: 'cand-2',
          taskType: 'TYPE_B',
          briefDescription: 'Tests skill B',
        },
        {
          candidateId: 'cand-3',
          taskType: 'TYPE_C',
          briefDescription: 'Tests skill C',
        },
        {
          candidateId: 'cand-4',
          taskType: 'TYPE_D',
          briefDescription: 'Tests skill D',
        },
      ],
    };

    const parsed = schema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it('rejects a plan if any taskType is duplicated', () => {
    const duplicateData = {
      candidates: [
        {
          candidateId: 'cand-1',
          taskType: 'TYPE_A',
          briefDescription: 'Tests skill A',
        },
        {
          candidateId: 'cand-2',
          taskType: 'TYPE_B',
          briefDescription: 'Tests skill B',
        },
        {
          candidateId: 'cand-3',
          taskType: 'TYPE_A', // Duplicate of cand-1!
          briefDescription: 'Tests skill A again',
        },
        {
          candidateId: 'cand-4',
          taskType: 'TYPE_D',
          briefDescription: 'Tests skill D',
        },
      ],
    };

    const parsed = schema.safeParse(duplicateData);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.errors[0].message).toContain(
        'unique taskType',
      );
    }
  });

  it('rejects a plan if an unallowed taskType is provided', () => {
    const invalidTypeData = {
      candidates: [
        {
          candidateId: 'cand-1',
          taskType: 'UNKNOWN_TYPE',
          briefDescription: 'Tests unknown',
        },
      ],
    };

    const parsed = schema.safeParse(invalidTypeData);
    expect(parsed.success).toBe(false);
  });
});
