import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

export type DetectionRuleStatus =
  | 'ACTIVE'
  | 'INACTIVE';

export type ComparisonOperator =
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'EQUAL';

export type LocationResolutionStatus =
  | 'RESOLVED'
  | 'UNRESOLVED';

export interface DetectionConditionRecord {
  variableType: string;

  operator:
    ComparisonOperator;

  threshold: number;
}

export interface DetectionRuleRecord {
  ruleId: string;

  riskTypeCode: string;

  severityCode: string;

  condition:
    DetectionConditionRecord;

  status:
    DetectionRuleStatus;
}

export interface DetectionEvidenceRecord {

  /**
   * Required by the backend domain contract.
   *
   * Optional temporarily because the current legacy
   * frontend mock does not preserve measurementId
   * inside RiskDetectionSummary.
   */
  measurementId?: string;

  deviceId: string;

  variableType: string;

  value: number;

  measuredAt: Date;
}

export interface RiskLocationRecord {
  buildingId?: string;

  zoneId?: string;

  resolutionStatus:
    LocationResolutionStatus;
}

export interface SeverityChangeRecord {
  severityChangeId: string;

  previousSeverityCode: string;

  newSeverityCode: string;

  changedAt: Date;
}

export interface RiskDetectionRecord {
  riskDetectionId: string;

  /**
   * Required by the final Risk Detection model.
   *
   * Optional temporarily because the legacy mock
   * does not keep the originating ruleId.
   */
  ruleId?: string;

  riskTypeCode: string;

  currentSeverityCode: string;

  location:
    RiskLocationRecord;

  detectedAt: Date;

  evidence:
    DetectionEvidenceRecord[];

  severityChanges:
    SeverityChangeRecord[];
}

export interface ConfigureDetectionRuleInput {
  riskTypeCode: string;

  severityCode: string;

  variableType: string;

  operator:
    ComparisonOperator;

  threshold: number;
}

export interface RiskDetectionGateway {

  getRiskDetectionById(
    riskDetectionId: string,
  ):
    Observable<
      RiskDetectionRecord
      | undefined
    >;

  getRiskDetectionEvidence(
    riskDetectionId: string,
  ):
    Observable<
      RiskDetectionRecord
      | undefined
    >;

  configureDetectionRule(
    input:
      ConfigureDetectionRuleInput,
  ):
    Observable<
      DetectionRuleRecord
    >;

  changeDetectionRuleStatus(
    ruleId: string,

    active: boolean,
  ):
    Observable<
      DetectionRuleRecord
    >;
}

export const RISK_DETECTION_GATEWAY =
  new InjectionToken<RiskDetectionGateway>(
    'RISK_DETECTION_GATEWAY',
  );