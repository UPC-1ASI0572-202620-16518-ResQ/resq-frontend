import { DetectionRuleResourceDto } from '../../risk-detection/data-access/risk-detection.dto';
import { mapDetectionRuleResourceDto } from '../../risk-detection/data-access/risk-detection.mapper';
import { ComparisonOperator } from '../../risk-detection/data-access/risk-detection.gateway';
import {
  ZoneMonitoringProfileRequestDto,
  ZoneMonitoringProfileOperatorDto,
} from './monitoring.dto';
import { ZoneMonitoringProfile, ZoneMonitoringRuleInput } from './monitoring.gateway';

const PROFILE_OPERATOR_BY_DOMAIN: Record<ComparisonOperator, ZoneMonitoringProfileOperatorDto> = {
  GREATER_THAN: 'GreaterThan',
  GREATER_THAN_OR_EQUAL: 'GreaterThanOrEqual',
  LESS_THAN: 'LessThan',
  LESS_THAN_OR_EQUAL: 'LessThanOrEqual',
  EQUAL: 'Equal',
};

const DOMAIN_OPERATORS = new Set<ComparisonOperator>(Object.keys(PROFILE_OPERATOR_BY_DOMAIN) as ComparisonOperator[]);

export function mapZoneMonitoringProfileRequest(
  rules: readonly ZoneMonitoringRuleInput[],
): ZoneMonitoringProfileRequestDto {
  if (!rules.length) throw new Error('A zone monitoring profile requires at least one rule.');

  return {
    rules: rules.map((rule) => {
      if (!rule.riskTypeCode.trim() || !rule.severityCode.trim() || !rule.variableType.trim()) {
        throw new Error('Every zone monitoring rule requires risk, severity and variable codes.');
      }
      if (!Number.isFinite(rule.threshold)) {
        throw new Error('Every zone monitoring rule requires a finite threshold.');
      }
      return {
        riskTypeCode: rule.riskTypeCode,
        severityCode: rule.severityCode,
        variableType: rule.variableType,
        operator: PROFILE_OPERATOR_BY_DOMAIN[rule.operator],
        threshold: rule.threshold,
      };
    }),
  };
}

export function mapZoneMonitoringProfileResponse(resource: unknown): ZoneMonitoringProfile {
  if (!resource || typeof resource !== 'object') {
    throw new Error('Monitoring returned an invalid zone profile response.');
  }

  const candidate = resource as {
    zoneId?: unknown;
    source?: unknown;
    rules?: unknown;
  };
  if (
    typeof candidate.zoneId !== 'string' ||
    (candidate.source !== 'ZONE_OVERRIDE' && candidate.source !== 'GLOBAL_FALLBACK') ||
    !Array.isArray(candidate.rules) ||
    !candidate.rules.every(isDetectionRuleResource)
  ) {
    throw new Error('Monitoring returned an invalid zone profile response.');
  }

  return {
    zoneId: candidate.zoneId,
    source: candidate.source,
    rules: (candidate.rules as DetectionRuleResourceDto[]).map(mapDetectionRuleResourceDto),
  };
}

function isDetectionRuleResource(value: unknown): value is DetectionRuleResourceDto {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Record<string, unknown>;
  const condition = rule['condition'];
  if (!condition || typeof condition !== 'object') return false;
  const typedCondition = condition as Record<string, unknown>;

  return (
    typeof rule['ruleId'] === 'string' &&
    typeof rule['riskTypeCode'] === 'string' &&
    typeof rule['severityCode'] === 'string' &&
    (rule['status'] === 'ACTIVE' || rule['status'] === 'INACTIVE') &&
    typeof typedCondition['variableType'] === 'string' &&
    typeof typedCondition['operator'] === 'string' &&
    DOMAIN_OPERATORS.has(typedCondition['operator'] as ComparisonOperator) &&
    typeof typedCondition['threshold'] === 'number' &&
    Number.isFinite(typedCondition['threshold'])
  );
}
