import { InterfaceType } from './interface-type';
import { FinanceRoleModule, FinanceTaskType } from './finance/finance.role-module';
import { SalesRoleModule, SalesTaskType } from './sales/sales.role-module';
import { CustomerServiceRoleModule } from './customer-service/customer-service.role-module';
import { RoleRegistry } from './role-registry';
import { validateSimulationTasks } from '../../simulations/simulation-task.validator';

describe('case files in dedicated roles', () => {
  it('accepts a sales case-file task at the simulation save boundary', () => {
    const task = {
      id: 'task', questionBankId: null, taskType: SalesTaskType.COLD_OUTREACH_EMAIL,
      category: 'Sales', title: 'Outreach', scenarioDescription: 'Prepare outreach.',
      questionPrompt: 'Write an email.', businessProblemDerived: false,
      interfaceType: InterfaceType.CASE_FILE_TEXT_AREA,
      interfacePayload: { interfaceType: InterfaceType.CASE_FILE_TEXT_AREA, caseFile: { tabs: [{ label: 'Account', content: 'Account notes.' }] }, placeholder: null },
      openEndedComponent: { recipient: 'Prospect', goal: 'Arrange a meeting' },
    };
    expect(validateSimulationTasks([task], new RoleRegistry())[0].interfaceType).toBe(InterfaceType.CASE_FILE_TEXT_AREA);
  });

  it('offers case files for written finance and sales tasks without changing figure templates', () => {
    const written = FinanceRoleModule.allowedTaskPatternTypes.find((p) => p.key === FinanceTaskType.STAKEHOLDER_PUSHBACK_RESPONSE);
    expect(written?.allowedInterfaceTypes).toContain(InterfaceType.CASE_FILE_TEXT_AREA);
    const figures = FinanceRoleModule.allowedTaskPatternTypes.find((p) => p.key === FinanceTaskType.STATEMENT_ANALYSIS);
    expect(figures?.interfaceType).toBe(InterfaceType.TABLE_VIEW_WITH_CHART);
    expect(figures?.allowedInterfaceTypes).toBeUndefined();
    expect(SalesRoleModule.allowedTaskPatternTypes.find((p) => p.key === SalesTaskType.PIPELINE_PRIORITIZATION)?.interfaceType).toBe(InterfaceType.TABLE_VIEW_RESPONSE_PANEL);
    expect(CustomerServiceRoleModule.allowedTaskPatternTypes.some((p) => p.interfaceType === InterfaceType.CASE_FILE_TEXT_AREA)).toBe(true);
  });

  it('accepts a formatted case-file answer and rejects a mismatched payload', () => {
    const task = {
      id: 'task', questionBankId: null, taskType: SalesTaskType.COLD_OUTREACH_EMAIL,
      category: 'Sales', title: 'Outreach', scenarioDescription: 'Prepare outreach.',
      questionPrompt: 'Write an email.', businessProblemDerived: false,
      interfaceType: InterfaceType.CASE_FILE_RICH_TEXT_COMPOSER,
      interfacePayload: { interfaceType: InterfaceType.CASE_FILE_RICH_TEXT_COMPOSER, caseFile: { tabs: [{ label: 'Account', content: 'Account notes.' }] }, placeholder: null },
      openEndedComponent: { recipient: 'Prospect', goal: 'Arrange a meeting' },
    };
    expect(validateSimulationTasks([task], new RoleRegistry())[0].interfaceType).toBe(InterfaceType.CASE_FILE_RICH_TEXT_COMPOSER);
    expect(() => validateSimulationTasks([{ ...task, interfacePayload: { ...task.interfacePayload, interfaceType: InterfaceType.TEXT_AREA } }], new RoleRegistry())).toThrow();
  });
});
