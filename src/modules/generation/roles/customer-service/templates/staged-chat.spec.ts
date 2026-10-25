import { INTERFACE_SCHEMAS, InterfaceType } from '../../interface-type';
import { stagedChatSpec } from './staged-chat.template';

const turn = (message: string) => ({
  message,
  typingDelayMs: 1200,
  checkpoints: ['Apologises for the delay'],
  criticalErrors: ['Promises a refund the policy does not give'],
});

const input = {
  displayName: 'Priya S.',
  customerRecord: [
    { field: 'Plan', value: 'Standard' },
    { field: 'Account since', value: '2024' },
    { field: 'Open orders', value: '1' },
  ],
  ticketHistory: 'Two earlier tickets, both resolved.',
  policy: 'Late parcels: offer a re-send or a store credit within policy.',
  wordLimit: { min: 20, max: 120 },
  turnCount: 3,
  turns: [turn('My parcel is late.'), turn('Still nothing.'), turn('What happens now?')],
  branches: [],
};

describe('stagedChatSpec', () => {
  it('builds the three visible case-file tabs and keeps the script server-only', () => {
    const { interfacePayload, serverOnly } = stagedChatSpec.materialize(input);
    const tabs = (interfacePayload.caseFile as { tabs: { label: string }[] }).tabs;

    expect(tabs.map((tab) => tab.label)).toEqual(['Customer record', 'Ticket history', 'Policy']);
    expect(interfacePayload).not.toHaveProperty('turns');
    expect(serverOnly).toEqual({
      stagedChat: { turns: input.turns, branches: [] },
    });
  });

  it('keeps the visible payload valid under the strict staged chat schema', () => {
    const { interfacePayload } = stagedChatSpec.materialize(input);
    const result = INTERFACE_SCHEMAS[InterfaceType.STAGED_CHAT].safeParse({
      interfaceType: InterfaceType.STAGED_CHAT,
      ...interfacePayload,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload that smuggles a server-only field in', () => {
    const { interfacePayload } = stagedChatSpec.materialize(input);
    const result = INTERFACE_SCHEMAS[InterfaceType.STAGED_CHAT].safeParse({
      interfaceType: InterfaceType.STAGED_CHAT,
      ...interfacePayload,
      turns: input.turns,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid script before anything is stored', () => {
    expect(() => stagedChatSpec.materialize({ ...input, turnCount: 4 })).toThrow('3 customer messages for 4 turns');
  });
});
