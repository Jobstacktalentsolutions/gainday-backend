import { INTERFACE_SCHEMAS, InterfaceType } from '../../interface-type';
import { TaskSpecError } from '../../role-module.interface';
import { lineTrendSpec } from './line-trend.template';
import { revenueUnitsComboSpec } from './revenue-units-combo.template';
import { varianceBridgeSpec } from './variance-bridge.template';

function validPayload(interfacePayload: Record<string, unknown>) {
  return INTERFACE_SCHEMAS[InterfaceType.TABLE_VIEW_WITH_CHART].safeParse({
    interfaceType: InterfaceType.TABLE_VIEW_WITH_CHART,
    ...interfacePayload,
  }).success;
}

describe('lineTrendSpec', () => {
  it('keys the change from the first to the last period and draws the revenue line', () => {
    const { interfacePayload, objectiveComponent } = lineTrendSpec.materialize({
      currency: 'USD',
      periods: [
        { label: 'Jan', revenue: 100 },
        { label: 'Feb', revenue: 110 },
        { label: 'Mar', revenue: 125 },
        { label: 'Apr', revenue: 150 },
      ],
    });
    // (150 - 100) / 100 = 50.0%
    expect(objectiveComponent).toMatchObject({ correctValue: 50, unit: '%' });
    expect(interfacePayload.chart).toMatchObject({ type: 'line', categories: ['Jan', 'Feb', 'Mar', 'Apr'] });
    expect(validPayload(interfacePayload)).toBe(true);
  });
});

describe('revenueUnitsComboSpec', () => {
  it('keys revenue per unit and draws revenue as bars and units as a secondary-axis line', () => {
    const { interfacePayload, objectiveComponent } = revenueUnitsComboSpec.materialize({
      currency: 'USD',
      periods: [
        { label: 'Q1', revenue: 1000, unitsSold: 200 },
        { label: 'Q2', revenue: 1500, unitsSold: 250 },
        { label: 'Q3', revenue: 900, unitsSold: 300 },
      ],
    });
    expect(objectiveComponent).toMatchObject({
      correctValues: [[5], [6], [3]],
    });
    expect(interfacePayload.chart).toMatchObject({
      type: 'combo',
      series: [
        { name: 'Revenue', kind: 'bar', axis: 'primary' },
        { name: 'Units sold', kind: 'line', axis: 'secondary' },
      ],
    });
    expect(validPayload(interfacePayload)).toBe(true);
  });
});

describe('varianceBridgeSpec', () => {
  const drivers = [
    { label: 'Price increase', amount: 40 },
    { label: 'Volume shortfall', amount: -25 },
    { label: 'Freight', amount: -10 },
  ];

  it('keys the unexplained remainder and draws budget and actual as totals around the drivers', () => {
    const { interfacePayload, objectiveComponent } = varianceBridgeSpec.materialize({
      currency: 'USD',
      period: 'Q3 2027',
      budget: 500,
      actual: 530,
      drivers,
    });
    // 530 - 500 - (40 - 25 - 10) = 25
    expect(objectiveComponent).toMatchObject({ correctValue: 25, unit: 'USD' });
    expect(interfacePayload.chart).toMatchObject({
      type: 'waterfall',
      categories: ['Budget', 'Price increase', 'Volume shortfall', 'Freight', 'Actual'],
      values: [500, 40, -25, -10, 530],
      totals: [true, false, false, false, true],
    });
    expect(validPayload(interfacePayload)).toBe(true);
  });

  it('rejects a bridge whose drivers already explain the whole variance', () => {
    expect(() =>
      varianceBridgeSpec.materialize({
        currency: 'USD',
        period: 'Q3 2027',
        budget: 500,
        // The drivers sum to +5, so an actual of 505 leaves nothing unexplained.
        actual: 505,
        drivers,
      }),
    ).toThrow(TaskSpecError);
  });
});
