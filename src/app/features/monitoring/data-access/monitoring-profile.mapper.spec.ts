import { ZoneMonitoringRuleInput } from './monitoring.gateway';
import {
  mapZoneMonitoringProfileRequest,
  mapZoneMonitoringProfileResponse,
} from './monitoring-profile.mapper';

describe('zone monitoring profile mapping', () => {
  it('maps every domain operator to the profile endpoint contract', () => {
    const operators = [
      ['GREATER_THAN', 'GreaterThan'],
      ['GREATER_THAN_OR_EQUAL', 'GreaterThanOrEqual'],
      ['LESS_THAN', 'LessThan'],
      ['LESS_THAN_OR_EQUAL', 'LessThanOrEqual'],
      ['EQUAL', 'Equal'],
    ] as const;

    for (const [operator, expected] of operators) {
      expect(mapZoneMonitoringProfileRequest([rule(operator)]).rules[0].operator).toBe(expected);
    }
  });

  it('preserves existing rules when a new rule is appended', () => {
    const existing = rule('GREATER_THAN', 'GAS_ADC', 500);
    const created = rule('GREATER_THAN_OR_EQUAL', 'TEMPERATURE_C', 26);

    const body = mapZoneMonitoringProfileRequest([existing, created]);

    expect(body.rules).toHaveLength(2);
    expect(body.rules.map((item) => item.variableType)).toEqual(['GAS_ADC', 'TEMPERATURE_C']);
  });

  it('rejects invalid requests before issuing a destructive replacement', () => {
    expect(() => mapZoneMonitoringProfileRequest([])).toThrow(/at least one rule/i);
    expect(() => mapZoneMonitoringProfileRequest([{ ...rule('EQUAL'), threshold: Number.NaN }]))
      .toThrow(/finite threshold/i);
  });

  it('validates and maps the server response', () => {
    const profile = mapZoneMonitoringProfileResponse({
      zoneId: 'zone-1',
      source: 'ZONE_OVERRIDE',
      rules: [{
        ruleId: 'rule-1',
        riskTypeCode: 'GAS_LEAK',
        severityCode: 'Warning',
        condition: { variableType: 'GAS_ADC', operator: 'GREATER_THAN', threshold: 500 },
        status: 'ACTIVE',
      }],
    });
    expect(profile.rules[0].condition.operator).toBe('GREATER_THAN');
    expect(() => mapZoneMonitoringProfileResponse({ zoneId: 'zone-1', rules: [] }))
      .toThrow(/invalid zone profile response/i);
    expect(() => mapZoneMonitoringProfileResponse({
      zoneId: 'zone-1',
      source: 'ZONE_OVERRIDE',
      rules: [{
        ruleId: 'rule-1',
        riskTypeCode: 'GAS_LEAK',
        severityCode: 'Warning',
        condition: { variableType: 'GAS_ADC', operator: 'UNKNOWN', threshold: 500 },
        status: 'ACTIVE',
      }],
    })).toThrow(/invalid zone profile response/i);
  });
});

function rule(
  operator: ZoneMonitoringRuleInput['operator'],
  variableType = 'GAS_ADC',
  threshold = 1,
): ZoneMonitoringRuleInput {
  return {
    riskTypeCode: 'GAS_LEAK',
    severityCode: 'Warning',
    variableType,
    operator,
    threshold,
  };
}
