export type DetectionRuleStatusDto =
  | 'ACTIVE'
  | 'INACTIVE';

export type ComparisonOperatorDto =
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'EQUAL';

export type LocationResolutionStatusDto =
  | 'RESOLVED'
  | 'UNRESOLVED';

export interface DetectionConditionResourceDto {
  variableType: string;

  operator:
    ComparisonOperatorDto;

  threshold: number;
}

export interface DetectionRuleResourceDto {
  ruleId: string;

  riskTypeCode: string;

  severityCode: string;

  condition:
    DetectionConditionResourceDto;

  status:
    DetectionRuleStatusDto;
}

export interface DetectionEvidenceResourceDto {
  measurementId: string;

  deviceId: string;

  variableType: string;

  value: number;

  measuredAt: string;
}

export interface RiskLocationResourceDto {
  buildingId?:
    string
    | null;

  zoneId?:
    string
    | null;

  resolutionStatus:
    LocationResolutionStatusDto;
}

export interface SeverityChangeResourceDto {
  severityChangeId: string;

  previousSeverityCode: string;

  newSeverityCode: string;

  changedAt: string;
}

export interface RiskDetectionResourceDto {
  riskDetectionId: string;

  ruleId: string;

  riskTypeCode: string;

  currentSeverityCode: string;

  location:
    RiskLocationResourceDto;

  detectedAt: string;

  evidence:
    DetectionEvidenceResourceDto[];

  severityChanges:
    SeverityChangeResourceDto[];
}

export interface ConfigureDetectionRuleResourceDto {
  riskTypeCode: string;

  severityCode: string;

  variableType: string;

  operator:
    ComparisonOperatorDto;

  threshold: number;
}

export interface ChangeDetectionRuleStatusResourceDto {
  active: boolean;
}