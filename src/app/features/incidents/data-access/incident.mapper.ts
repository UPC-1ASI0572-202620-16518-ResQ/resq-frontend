import {
  Incident as LegacyIncident,
} from '../../../core/models/resq.models';

import {
  IncidentPageResourceDto,
  IncidentResourceDto,
} from './incident.dto';

import {
  IncidentRecord,
  IncidentRiskType,
} from './incident.gateway';

import {
  PagedResult,
} from '../../../core/api/pagination';

export function mapIncidentResourceDto(
  dto:
    IncidentResourceDto,
):
  IncidentRecord {

  return {
    incidentId:
      dto.id,

    riskDetectionId: dto.riskDetectionId ?? undefined,
    alertId: dto.alertId ?? undefined,

    zoneId:
      dto.zoneId,

    type:
      normalizeCode(dto.type) as IncidentRecord['type'],

    level:
      normalizeCode(dto.level) as IncidentRecord['level'],

    status:
      normalizeCode(dto.status) as IncidentRecord['status'],

    assignedTo:
      dto.assignedUserId != null ? String(dto.assignedUserId) : dto.assignedTo ?? undefined,

    assignedUserId: dto.assignedUserId ?? undefined,

    assignedAt: dto.assignedAt ? new Date(dto.assignedAt) : undefined,
    safeAt: dto.safetyVerifications?.filter((item) => item.safe).at(-1)?.verifiedAt
      ? new Date(dto.safetyVerifications.filter((item) => item.safe).at(-1)!.verifiedAt)
      : undefined,
    resolvedBy: dto.resolvedByUserId != null ? String(dto.resolvedByUserId) : undefined,
    closedAt: dto.closedAt ? new Date(dto.closedAt) : undefined,
    closedBy: dto.closedByUserId != null ? String(dto.closedByUserId) : undefined,
    safetyVerified: Boolean(dto.safetyVerified),
    humanActions: (dto.humanActions ?? []).map((item) => ({
      id: item.id,
      userId: item.userId,
      actionCode: normalizeCode(item.actionCode),
      notes: item.notes ?? undefined,
      performedAt: new Date(item.performedAt),
    })),
    safetyVerifications: (dto.safetyVerifications ?? []).map((item) => ({
      id: item.id,
      verifiedByUserId: item.verifiedByUserId,
      safe: item.safe,
      reason: item.reason,
      deviceId: item.deviceId ?? undefined,
      measurementId: item.measurementId ?? undefined,
      measuredValue: item.measuredValue ?? undefined,
      measuredAt: item.measuredAt ? new Date(item.measuredAt) : undefined,
      ruleSnapshot: item.ruleSnapshot ?? undefined,
      verifiedAt: new Date(item.verifiedAt),
    })),

    createdAt:
      new Date(
        dto.createdAt,
      ),

    resolvedAt:
      dto.resolvedAt
        ? new Date(
            dto.resolvedAt,
          )
        : undefined,

    resolutionNotes:
      dto.resolutionNotes ??
      undefined,
  };
}

export function mapIncidentPageResourceDto(
  dto:
    IncidentPageResourceDto,
):
  PagedResult<
    IncidentRecord
  > {

  return {
    items:
      dto.items.map(
        mapIncidentResourceDto,
      ),

    page:
      dto.page,

    size:
      dto.size,

    totalElements:
      dto.totalElements,

    totalPages:
      dto.totalPages,
  };
}

export function mapLegacyIncidentToRecord(
  incident:
    LegacyIncident,

  riskType:
    IncidentRiskType = incident.riskTypeCode,
):
  IncidentRecord {

  return {
    incidentId:
      incident.id,

    riskDetectionId:
      incident.riskDetectionId,

    detectedEvidence: {
      deviceId: incident.evidence.deviceId,
      metric: incident.evidence.metric,
      value: incident.evidence.value,
      unit: incident.evidence.unit,
      warningThreshold: incident.evidence.warningThreshold,
      criticalThreshold: incident.evidence.criticalThreshold,
      measuredAt: new Date(incident.evidence.capturedAt),
    },

    currentEvidence: {
      deviceId: incident.currentEvidence.deviceId,
      metric: incident.currentEvidence.metric,
      value: incident.currentEvidence.value,
      unit: incident.currentEvidence.unit,
      warningThreshold: incident.currentEvidence.warningThreshold,
      criticalThreshold: incident.currentEvidence.criticalThreshold,
      measuredAt: new Date(incident.currentEvidence.capturedAt),
    },

    /*
     * The current legacy frontend calls this
     * field spaceId. In the final Building
     * Management model that location is a Zone.
     */
    zoneId:
      incident.spaceId,

    type:
      riskType,

    /*
     * The legacy model stores AlertSeverity,
     * which is NOT the same value object as
     * Incident.RiskLevel.
     *
     * Only CRITICAL has an exact semantic match.
     * For Info/Warning we intentionally leave the
     * Incident RiskLevel unavailable rather than
     * invent LOW/MEDIUM/HIGH mappings.
     */
    level:
      incident.severity ===
      'Critical'
        ? 'CRITICAL'
        : undefined,

    status:
      mapLegacyStatus(
        incident.status,
      ),

    assignedTo:
      incident.assignedTo,

    assignedAt: incident.assignedAt ? new Date(incident.assignedAt) : undefined,
    safeAt: incident.safeAt ? new Date(incident.safeAt) : undefined,
    resolvedBy: incident.resolvedBy,

    createdAt:
      new Date(
        incident.createdAt,
      ),

    resolvedAt:
      incident.resolvedAt
        ? new Date(
            incident.resolvedAt,
          )
        : undefined,

    resolutionNotes:
      incident.resolutionNotes,

    safetyVerified: false,
    humanActions: [],
    safetyVerifications: [],
  };
}

export function cloneIncident(
  incident:
    IncidentRecord,
):
  IncidentRecord {

  return {
    ...incident,

    detectedEvidence: incident.detectedEvidence
      ? { ...incident.detectedEvidence, measuredAt: new Date(incident.detectedEvidence.measuredAt) }
      : undefined,
    currentEvidence: incident.currentEvidence
      ? { ...incident.currentEvidence, measuredAt: new Date(incident.currentEvidence.measuredAt) }
      : undefined,

    createdAt:
      new Date(
        incident.createdAt,
      ),

    resolvedAt:
      incident.resolvedAt
        ? new Date(
            incident.resolvedAt,
          )
        : undefined,

    assignedAt: incident.assignedAt ? new Date(incident.assignedAt) : undefined,
    safeAt: incident.safeAt ? new Date(incident.safeAt) : undefined,
  };
}

function mapLegacyStatus(
  status:
    LegacyIncident['status'],
):
  IncidentRecord['status'] {

  switch (
    status
  ) {

    case 'Open':
      return 'ACTIVE';

    case 'InProgress':
      return 'IN_PROGRESS';

    case 'Resolved':
      return 'RESOLVED';
  }
}

function normalizeCode(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}
