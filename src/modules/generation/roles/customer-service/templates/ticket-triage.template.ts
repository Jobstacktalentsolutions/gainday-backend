import { z } from 'zod';
import { defineTaskSpec, requireUnique, requireValid } from '../../task-spec';
import { caseFilePayload, factTable } from '../case-file';

const TIER_WEIGHT = { VIP: 3, STANDARD: 2, BASIC: 1 } as const;
const IMPACT_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
const URGENCY_WINDOW_HOURS = 24;
const REPLY_NOW_HOURS = 4;
const ACTION_BUCKETS = ['Work first', 'Reply now', 'Holding reply', 'Escalate', 'Defer'];

const dataSchema = z.object({
  tickets: z
    .array(
      z.object({
        id: z.string().describe('Ticket ID, unique, e.g. "T-101".'),
        summary: z.string().describe('One line describing the issue. State no figures.'),
        tier: z.enum(['VIP', 'STANDARD', 'BASIC']),
        impact: z.enum(['HIGH', 'MEDIUM', 'LOW']),
        slaHoursLeft: z.number().int().min(0).max(72),
        needsSpecialist: z.boolean(),
      }),
    )
    .min(3)
    .max(5),
});

// Ticket triage (customer service doc Section 2.6). The guideline is fixed in code and shown in full,
// so every priority and action is derived from it. The task is rejected unless one ticket is the
// unambiguous first pick.
export const ticketTriageSpec = defineTaskSpec(dataSchema, (data) => {
  requireUnique(
    data.tickets.map((ticket) => ticket.id),
    'ticket IDs',
  );

  const scored = data.tickets
    .map((ticket) => ({
      ticket,
      score:
        TIER_WEIGHT[ticket.tier] * 10 +
        IMPACT_WEIGHT[ticket.impact] * 10 +
        Math.max(0, URGENCY_WINDOW_HOURS - ticket.slaHoursLeft),
    }))
    .sort((a, b) => b.score - a.score);
  requireValid(
    scored[0].score > scored[1].score,
    'the first ticket to work must be unique',
  );
  const firstId = scored[0].ticket.id;

  const actionFor = (ticket: (typeof data.tickets)[number]) => {
    if (ticket.id === firstId) return 'Work first';
    if (ticket.needsSpecialist) return 'Escalate';
    if (ticket.slaHoursLeft <= REPLY_NOW_HOURS) return 'Reply now';
    if (ticket.impact !== 'LOW') return 'Holding reply';
    return 'Defer';
  };

  const guideline = [
    `**Priority score:** tier (VIP 3, Standard 2, Basic 1) × 10, plus impact (High 3, Medium 2, Low 1) × 10, plus urgency (${URGENCY_WINDOW_HOURS} minus SLA hours left, never below 0). Work the highest score first.`,
    `**Then, for each other ticket:** escalate if it needs a specialist; reply now if the SLA is ${REPLY_NOW_HOURS} hours or less; send a holding reply if impact is not low; otherwise defer.`,
  ].join('\n\n');

  return {
    interfacePayload: caseFilePayload(
      [
        {
          label: 'Queue',
          content: factTable(
            data.tickets.map((ticket) => [
              ticket.id,
              `${ticket.summary} (tier ${ticket.tier.toLowerCase()}, impact ${ticket.impact.toLowerCase()}, SLA ${ticket.slaHoursLeft} hours left${ticket.needsSpecialist ? ', needs a specialist' : ''})`,
            ]),
            ['Ticket', 'Details'],
          ),
        },
        { label: 'Triage guideline', content: guideline },
      ],
      { min: 30, max: 90 },
    ),
    objectiveComponent: {
      items: data.tickets.map((ticket) => ticket.id),
      buckets: ACTION_BUCKETS,
      correctMapping: data.tickets.map((ticket) => ({
        item: ticket.id,
        bucket: actionFor(ticket),
      })),
    },
    rubric: {
      checklist: [
        "Justifies the first ticket using the guideline's rules",
        'Sets expectations for the tickets not worked first',
      ],
      gate: null,
      authorisedCommitments: [{ kind: 'ESCALATION', amount: null }],
    },
  };
});
