import { RoleModule } from '../role-module.interface';

/**
 * Sales role module stub. Registers under the Category router so extraction can resolve
 * "Sales" jobs, but carries no real content yet — sales content (allowed task-pattern types,
 * anchor-criteria framing, critic checks, presentation spec) is pending the companion
 * "GAINDAY Sales Role: Simulation Categories & Grading" document.
 *
 * `allowedTaskPatternTypes` is deliberately empty. The overgenerate node checks for this and
 * throws RoleModuleNotConfiguredError rather than falling back to finance's taxonomy — sales
 * is conversational/situational, not finance's static data/document shape, so generating
 * finance-shaped tasks for a sales job would be actively wrong, not just incomplete.
 *
 * Sub-role granularity (SDR/AE/CSM) is not yet split out — all "Sales" categories currently
 * fall through to this single stub via the registry's exact-match. When sales content arrives,
 * register additional modules under categoryKeys like "Sales > SDR", "Sales > AE", "Sales > CSM"
 * — the registry's '>'-prefix matching requires no changes to support this.
 */
export const SalesRoleModule: RoleModule = {
  categoryKeys: ['Sales'],

  extraction: {
    categorySubDomainGuidance:
      'TODO(sales-content): sub-role granularity (SDR/AE/CSM) framing pending companion Sales document.',
    intentFramingGuidance:
      'TODO(sales-content): pending companion Sales document.',
    expectedTaskGuidance:
      'TODO(sales-content): pending companion Sales document.',
  },

  allowedTaskPatternTypes: [],

  anchorCriteriaFraming: {
    problemSolving: 'TODO(sales-content)',
    judgmentExecution: 'TODO(sales-content)',
    writtenCommunication: 'TODO(sales-content)',
    commercialDomainAwareness: 'TODO(sales-content)',
  },

  criticChecks: {
    checkAnchorCorrectness() {
      return Promise.reject(
        new Error(
          'Sales role module has no anchor-correctness check yet — companion Sales content pending.',
        ),
      );
    },
  },

  presentationSpec: {
    rendererHint: 'sales-conversational',
    notes:
      'TODO(sales-content): message-thread/persona presentation spec pending.',
  },
};
