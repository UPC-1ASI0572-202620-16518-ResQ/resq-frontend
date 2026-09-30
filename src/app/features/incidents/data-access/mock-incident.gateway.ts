import {
  Injectable,
  signal,
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

import {
  ALERTS,
  INCIDENTS,
} from '../../../core/mock-data/resq.mock';

import {
  IncidentGateway,
  IncidentQueryFilters,
  IncidentRecord,
  IncidentRiskType,
} from './incident.gateway';

import {
  cloneIncident,
  mapLegacyIncidentToRecord,
} from './incident.mapper';

@Injectable()
export class MockIncidentGateway
  implements IncidentGateway {

  private readonly items =
    signal<
      IncidentRecord[]
    >(
      INCIDENTS.map(
        incident =>
          mapLegacyIncidentToRecord(
            incident,
            resolveRiskType(
              incident.alertIds,
            ),
          ),
      ),
    );

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
      this.items()
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
      this.items().find(
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
      this.items().find(
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
      this.items().find(
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

    this.items.update(
      items =>
        items.map(
          item =>
            item.incidentId ===
            incident.incidentId
              ? incident
              : item,
        ),
    );
  }
}

function resolveRiskType(
  alertIds:
    string[],
):
  IncidentRiskType {

  for (
    const alertId
    of alertIds
  ) {

    const alert =
      ALERTS.find(
        item =>
          item.alertId ===
          alertId,
      );

    if (!alert) {
      continue;
    }

    switch (
      alert.context
        .riskTypeCode
    ) {

      case 'FIRE':
        return 'FIRE';

      case 'GAS_LEAK':
        return 'GAS_LEAK';
    }
  }

  return 'UNKNOWN';
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