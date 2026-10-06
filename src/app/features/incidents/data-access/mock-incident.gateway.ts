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

  constructor(private readonly events: RiskEventStoreService) {}

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

    const next:
      IncidentRecord = {

      ...cloneIncident(
        current,
      ),

      assignedTo:
        normalizedAttendantId,

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
      'CLOSED'
    ) {

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
      resolvedAt: incident.resolvedAt,
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
