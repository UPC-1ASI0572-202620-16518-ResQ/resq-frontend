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

export interface IncidentRecord {
  incidentId: string;

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

  createdAt:
    Date;

  resolvedAt?: Date;

  resolutionNotes?: string;
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

  resolveIncident(
    incidentId: string,

    resolutionNotes: string,
  ):
    Observable<
      IncidentRecord
    >;
}

export const INCIDENT_GATEWAY =
  new InjectionToken<IncidentGateway>(
    'INCIDENT_GATEWAY',
  );