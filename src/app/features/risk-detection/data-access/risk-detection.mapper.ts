import {
  DetectionRuleResourceDto,
  RiskDetectionResourceDto,
} from './risk-detection.dto';

import {
  DetectionRuleRecord,
  RiskDetectionRecord,
} from './risk-detection.gateway';

export function mapDetectionRuleResourceDto(
  dto:
    DetectionRuleResourceDto,
):
  DetectionRuleRecord {

  return {
    ruleId:
      dto.ruleId,

    riskTypeCode:
      dto.riskTypeCode,

    severityCode:
      dto.severityCode,

    condition: {

      variableType:
        dto.condition
          .variableType,

      operator:
        dto.condition
          .operator,

      threshold:
        dto.condition
          .threshold,
    },

    status:
      dto.status,
  };
}
export function mapRiskDetectionResourceDto(
  dto:
    RiskDetectionResourceDto,
):
  RiskDetectionRecord {

  return {
    riskDetectionId:
      dto.riskDetectionId,

    ruleId:
      dto.ruleId,

    riskTypeCode:
      dto.riskTypeCode,

    currentSeverityCode:
      dto.currentSeverityCode,

    location: {

      buildingId:
        dto.location
          .buildingId ??
        undefined,

      zoneId:
        dto.location
          .zoneId ??
        undefined,

      resolutionStatus:
        dto.location
          .resolutionStatus,
    },

    detectedAt:
      new Date(
        dto.detectedAt,
      ),

    evidence:
      dto.evidence.map(
        evidence => ({

          measurementId:
            evidence
              .measurementId,

          deviceId:
            evidence.deviceId,

          variableType:
            evidence
              .variableType,

          value:
            evidence.value,

          measuredAt:
            new Date(
              evidence
                .measuredAt,
            ),
        }),
      ),

    severityChanges:
      dto.severityChanges.map(
        change => ({

          severityChangeId:
            change
              .severityChangeId,

          previousSeverityCode:
            change
              .previousSeverityCode,

          newSeverityCode:
            change
              .newSeverityCode,

          changedAt:
            new Date(
              change.changedAt,
            ),
        }),
      ),
  };
}
