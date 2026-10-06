import {
  Injectable,
} from '@angular/core';

import {
  Observable,
  delay,
  of,
  throwError,
} from 'rxjs';

import {
  ApiError,
} from '../../../core/api/api-error';

import {
  PageRequest,
  PagedResult,
  paginateInMemory,
} from '../../../core/api/pagination';

import { RiskEventStoreService } from '../../../core/services/risk-event-store.service';
import { BuildingStoreService } from '../../../core/services/building-store.service';
import { evaluateMeasurement } from '../../../core/services/risk-evaluation.service';
import { AuthorizationService } from '../../auth/authorization.service';

import {
  IncidentGateway,
  IncidentQueryFilters,
  IncidentRecord,
} from './incident.gateway';

import {
  cloneIncident,
  mapLegacyIncidentToRecord,
} from './incident.mapper';

@Injectable()
export class MockIncidentGateway
  implements IncidentGateway {

  constructor(
    private readonly events: RiskEventStoreService,
    private readonly buildings: BuildingStoreService,
    private readonly authorization: AuthorizationService,
  ) {}

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
    > {

    const result =
      this.incidentRecords()
        .filter(
          incident =>
            !filters.zoneId ||
            incident.zoneId ===
              filters.zoneId,
        )
        .filter(
          incident =>
            !filters.type ||
            incident.type ===
              filters.type,
        )
        .filter(
          incident =>
            !filters.status ||
            incident.status ===
              filters.status,
        )
        .filter(
          incident =>
            !filters.startDate ||
            incident.createdAt
              .getTime() >=
              filters.startDate
                .getTime(),
        )
        .filter(
          incident =>
            !filters.endDate ||
            incident.createdAt
              .getTime() <=
              filters.endDate
                .getTime(),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.createdAt
              .getTime() -
            left.createdAt
              .getTime(),
        )
        .map(
          cloneIncident,
        );

    return of(
      paginateInMemory(
        result,
        normalizePage(
          page,
        ),
      ),
    ).pipe(
      delay(80),
    );
  }

  getIncidentById(
    incidentId: string,
  ):
    Observable<
      IncidentRecord
      | undefined
    > {

    const incident =
      this.incidentRecords().find(
        item =>
          item.incidentId ===
          incidentId,
      );

    return of(
      incident
        ? cloneIncident(
            incident,
          )
        : undefined,
    ).pipe(
      delay(60),
    );
  }

  assignIncident(
    incidentId: string,

    attendantId: string,
  ):
    Observable<
      IncidentRecord
    > {

    let administratorId: string;
    try {
      administratorId = this.authorization.requireIncidentManager().userId!;
    } catch (error) {
      return throwError(() => error);
    }

    const current =
      this.incidentRecords().find(
        item =>
          item.incidentId ===
          incidentId,
      );

    if (!current) {

      return throwError(
        () =>
          incidentNotFound(),
      );
    }

    if (
      current.status ===
        'RESOLVED' ||
      current.status ===
        'CLOSED'
    ) {

      return throwError(
        () =>
          conflict(
            'INCIDENT_NOT_ASSIGNABLE',

            'A resolved or closed incident cannot be assigned.',
          ),
      );
    }

    const normalizedAttendantId =
      attendantId.trim();

    if (
      !normalizedAttendantId
    ) {

      return throwError(
        () =>
          badRequest(
            'ATTENDANT_REQUIRED',

            'An attendant is required.',
          ),
      );
    }

    if (normalizedAttendantId !== administratorId) {
      return throwError(
        () =>
          apiError(
            403,
            'INCIDENT_ASSIGNMENT_FORBIDDEN',
            'An administrator may only use Assign to me for the current session user.',
          ),
      );
    }

    const next:
      IncidentRecord = {

      ...cloneIncident(
        current,
      ),

      assignedTo:
        normalizedAttendantId,

      assignedAt: new Date(),

      status:
        'IN_PROGRESS',
    };

    this.replace(
      next,
    );

    return of(
      cloneIncident(
        next,
      ),
    ).pipe(
      delay(90),
    );
  }

  resolveIncident(
    incidentId: string,

    resolutionNotes: string,
  ):
    Observable<
      IncidentRecord
    > {

    let administratorId: string;
    try {
      administratorId = this.authorization.requireIncidentManager().userId!;
    } catch (error) {
      return throwError(() => error);
    }

    const current =
      this.incidentRecords().find(
        item =>
          item.incidentId ===
          incidentId,
      );

    if (!current) {

      return throwError(
        () =>
          incidentNotFound(),
      );
    }

    if (current.status === 'CLOSED') {

      return throwError(
        () =>
          conflict(
            'INCIDENT_CLOSED',

            'A closed incident cannot be modified.',
          ),
      );
    }

    if (
      current.status ===
      'RESOLVED'
    ) {

      return throwError(
        () =>
          conflict(
            'INCIDENT_ALREADY_RESOLVED',

            'The incident has already been resolved.',
          ),
      );
    }

    if (current.status !== 'IN_PROGRESS') {
      return throwError(
        () =>
          conflict(
            'INCIDENT_NOT_IN_PROGRESS',
            'Assign the Incident and move it to IN_PROGRESS before resolving it.',
          ),
      );
    }

    if (current.assignedTo !== administratorId) {
      return throwError(
        () =>
          apiError(
            403,
            'INCIDENT_ASSIGNEE_REQUIRED',
            'Only the administrator assigned to this Incident may resolve it.',
          ),
      );
    }

    const source = this.events.incidents().find((item) => item.id === incidentId);
    const device = this.buildings.devices().find(
      (item) => item.id === source?.currentEvidence.deviceId,
    );
    const space = this.buildings.spaces().find((item) => item.id === source?.spaceId);
    const reading = device?.readings.at(-1);
    const thresholds = reading && space ? space.thresholds[reading.metric] : undefined;
    if (!reading || evaluateMeasurement(reading.value, thresholds) !== 'Normal') {
      return throwError(
        () =>
          conflict(
            'INCIDENT_CONDITION_NOT_SAFE',
            'The current measurement must be below the warning threshold before the Incident can be resolved.',
          ),
      );
    }

    const notes =
      resolutionNotes.trim();

    if (!notes) {

      return throwError(
        () =>
          badRequest(
            'RESOLUTION_NOTES_REQUIRED',

            'Resolution notes are required.',
          ),
      );
    }

    const next:
      IncidentRecord = {

      ...cloneIncident(
        current,
      ),

      status:
        'RESOLVED',

      resolutionNotes:
        notes,

      resolvedAt:
        new Date(),

      safeAt: current.safeAt ?? new Date(),

      resolvedBy: administratorId,
    };

    this.replace(
      next,
    );

    return of(
      cloneIncident(
        next,
      ),
    ).pipe(
      delay(100),
    );
  }

  private replace(
    incident:
      IncidentRecord,
  ): void {

    const legacy = this.events.incidents().find((item) => item.id === incident.incidentId);
    if (!legacy) return;
    this.events.updateIncident({
      ...legacy,
      status:
        incident.status === 'ACTIVE'
          ? 'Open'
          : incident.status === 'IN_PROGRESS'
            ? 'InProgress'
            : 'Resolved',
      assignedTo: incident.assignedTo,
      assignedAt: incident.assignedAt,
      safeAt: incident.safeAt,
      resolvedAt: incident.resolvedAt,
      resolvedBy: incident.resolvedBy,
      resolutionNotes: incident.resolutionNotes,
    });
  }

  private incidentRecords(): IncidentRecord[] {
    return this.events.incidents().map((incident) => mapLegacyIncidentToRecord(incident));
  }
}

function normalizePage(
  request:
    PageRequest,
):
  PageRequest {

  return {
    page:
      Math.max(
        0,
        Math.trunc(
          request.page,
        ),
      ),

    size:
      Math.min(
        100,

        Math.max(
          1,
          Math.trunc(
            request.size ||
            20,
          ),
        ),
      ),
  };
}

function apiError(
  status: number,

  code: string,

  message: string,
):
  ApiError {

  return {
    status,
    code,
    message,
    fieldErrors: [],
  };
}

function badRequest(
  code: string,

  message: string,
):
  ApiError {

  return apiError(
    400,
    code,
    message,
  );
}

function conflict(
  code: string,

  message: string,
):
  ApiError {

  return apiError(
    409,
    code,
    message,
  );
}

function incidentNotFound():
  ApiError {

  return apiError(
    404,

    'INCIDENT_NOT_FOUND',

    'The requested incident was not found.',
  );
}
