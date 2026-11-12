import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

import {
  PageRequest,
  PagedResult,
} from '../../../core/api/pagination';

export type IncidentStatus =
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export type IncidentRiskType =
  | 'EARTHQUAKE'
  | 'FIRE'
  | 'GAS_LEAK'
  | 'UNKNOWN';

export type IncidentRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export interface IncidentEvidenceRecord {
  deviceId: string;
  metric: string;
  value: number;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  measuredAt: Date;
}

export interface IncidentRecord {
  incidentId: string;

  /** Originating CRITICAL Risk Detection. Optional only for HTTP compatibility. */
  riskDetectionId?: string;
  alertId?: string;

  /** TODO(OpenAPI): optional compatibility evidence until the backend schema is published. */
  detectedEvidence?: IncidentEvidenceRecord;
  currentEvidence?: IncidentEvidenceRecord;

  zoneId: string;

  type:
    IncidentRiskType;

  /**
   * The current legacy frontend does not always
   * preserve the exact Incident RiskLevel defined
   * by the Incident bounded context.
   *
   * It is therefore temporarily optional in the
   * frontend compatibility model.
   *
   * The real backend contract must provide it.
   */
  level?:
    IncidentRiskLevel;

  status:
    IncidentStatus;

  assignedTo?: string;

  assignedUserId?: number;

  assignedAt?: Date;

  safeAt?: Date;

  resolvedBy?: string;

  closedAt?: Date;
  closedBy?: string;
  safetyVerified: boolean;
  humanActions: IncidentHumanActionRecord[];
  safetyVerifications: IncidentSafetyVerificationRecord[];

  createdAt:
    Date;

  resolvedAt?: Date;

  resolutionNotes?: string;
}

export interface IncidentHumanActionRecord {
  id: string;
  userId: number;
  actionCode: string;
  notes?: string;
  performedAt: Date;
}

export interface IncidentSafetyVerificationRecord {
  id: string;
  verifiedByUserId: number;
  safe: boolean;
  reason: string;
  deviceId?: string;
  measurementId?: string;
  measuredValue?: number;
  measuredAt?: Date;
  ruleSnapshot?: string;
  verifiedAt: Date;
}

export interface IncidentQueryFilters {
  zoneId?: string;

  type?:
    IncidentRiskType;

  status?:
    IncidentStatus;

  startDate?: Date;

  endDate?: Date;
}

export interface IncidentGateway {

  getIncidents(
    filters:
      IncidentQueryFilters,

    page:
      PageRequest,
  ):
    Observable<
      PagedResult<
        IncidentRecord
      >
    >;

  getIncidentById(
    incidentId: string,
  ):
    Observable<
      IncidentRecord
      | undefined
    >;

  assignIncident(
    incidentId: string,

    attendantId: string,
  ):
    Observable<
      IncidentRecord
    >;

  assignCurrentUser(incidentId: string): Observable<IncidentRecord>;

  verifySafe(incidentId: string): Observable<IncidentSafetyVerificationRecord>;

  recordHumanAction(
    incidentId: string,
    actionCode: string,
    notes?: string,
  ): Observable<IncidentHumanActionRecord>;

  resolveIncident(
    incidentId: string,

    resolutionNotes: string,
  ):
    Observable<
      IncidentRecord
    >;

  closeIncident(
    incidentId: string,
  ):
    Observable<IncidentRecord>;
}

export const INCIDENT_GATEWAY =
  new InjectionToken<IncidentGateway>(
    'INCIDENT_GATEWAY',
  );
