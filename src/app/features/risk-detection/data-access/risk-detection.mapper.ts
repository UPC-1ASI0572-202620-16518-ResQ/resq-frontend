import {
  RiskDetectionSummary,
} from '../../../core/models/resq.models';

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

/**
 * Compatibility mapper for the current legacy mock.
 *
 * IMPORTANT:
 *
 * RiskDetectionSummary does not currently preserve:
 *
 * - originating ruleId
 * - measurementId
 * - resolved location
 * - severity changes
 *
 * Those values are deliberately left unavailable
 * rather than fabricated.
 */
export function mapLegacyRiskDetectionToRecord(
  detection:
    RiskDetectionSummary,
):
  RiskDetectionRecord {

  return {
    riskDetectionId:
      detection
        .riskDetectionId,

    ruleId:
      undefined,

    riskTypeCode:
      detection
        .riskTypeCode,

    currentSeverityCode:
      detection
        .severityCode,

    location: {

      resolutionStatus:
        'UNRESOLVED',
    },

    detectedAt:
      new Date(
        detection.detectedAt,
      ),

    evidence:
      detection.evidence.map(
        evidence => ({

          measurementId:
            undefined,

          deviceId:
            evidence.deviceId,

          /*
           * The legacy mock uses capabilityCode
           * where the future Risk Detection
           * contract expects variableType.
           *
           * We preserve the available code instead
           * of inventing another variable name.
           */
          variableType:
            evidence.capabilityCode,

          value:
            evidence.value,

          measuredAt:
            new Date(
              evidence.capturedAt,
            ),
        }),
      ),

    severityChanges:
      [],
  };
}

export function cloneRiskDetection(
  detection:
    RiskDetectionRecord,
):
  RiskDetectionRecord {

  return {
    ...detection,

    location: {
      ...detection.location,
    },

    detectedAt:
      new Date(
        detection.detectedAt,
      ),

    evidence:
      detection.evidence.map(
        evidence => ({

          ...evidence,

          measuredAt:
            new Date(
              evidence.measuredAt,
            ),
        }),
      ),

    severityChanges:
      detection.severityChanges.map(
        change => ({

          ...change,

          changedAt:
            new Date(
              change.changedAt,
            ),
        }),
      ),
  };
}