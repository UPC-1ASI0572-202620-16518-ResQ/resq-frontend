import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';

import {
  Inject,
  Injectable,
} from '@angular/core';

import {
  Observable,
  catchError,
  map,
  of,
  throwError,
} from 'rxjs';

import {
  API_CONFIG,
  ApiConfig,
  buildApiUrl,
} from '../../../core/api/api.config';

import {
  mapHttpError,
} from '../../../core/api/http-error.mapper';

import {
  PageRequest,
  PagedResult,
} from '../../../core/api/pagination';

import {
  AssignIncidentResourceDto,
  IncidentPageResourceDto,
  IncidentResourceDto,
  ResolveIncidentResourceDto,
} from './incident.dto';

import {
  IncidentGateway,
  IncidentQueryFilters,
  IncidentRecord,
} from './incident.gateway';

import {
  mapIncidentPageResourceDto,
  mapIncidentResourceDto,
} from './incident.mapper';

@Injectable()
export class HttpIncidentGateway
  implements IncidentGateway {

  private readonly incidentsPath =
    '/api/v1/incidents';

  constructor(

    private readonly http:
      HttpClient,

    @Inject(API_CONFIG)
    private readonly apiConfig:
      ApiConfig,
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

    let params =
      new HttpParams()
        .set(
          'page',
          String(
            Math.max(
              0,
              Math.trunc(
                page.page,
              ),
            ),
          ),
        )
        .set(
          'size',
          String(
            Math.min(
              100,

              Math.max(
                1,
                Math.trunc(
                  page.size ||
                  20,
                ),
              ),
            ),
          ),
        );

    if (
      filters.zoneId
    ) {

      params =
        params.set(
          'zoneId',
          filters.zoneId,
        );
    }

    if (
      filters.type
    ) {

      params =
        params.set(
          'type',
          filters.type,
        );
    }

    if (
      filters.status
    ) {

      params =
        params.set(
          'status',
          filters.status,
        );
    }

    if (
      filters.startDate
    ) {

      params =
        params.set(
          'startDate',

          filters
            .startDate
            .toISOString(),
        );
    }

    if (
      filters.endDate
    ) {

      params =
        params.set(
          'endDate',

          filters
            .endDate
            .toISOString(),
        );
    }

    return this.http
      .get<
        IncidentPageResourceDto
      >(
        buildApiUrl(
          this.apiConfig,
          this.incidentsPath,
        ),

        {
          params,
        },
      )
      .pipe(

        map(
          mapIncidentPageResourceDto,
        ),

        catchError(
          error =>
            throwError(
              () =>
                mapHttpError(
                  error,
                ),
            ),
        ),
      );
  }

  getIncidentById(
    incidentId: string,
  ):
    Observable<
      IncidentRecord
      | undefined
    > {

    return this.http
      .get<
        IncidentResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.incidentsPath}/${incidentId}`,
        ),
      )
      .pipe(

        map(
          mapIncidentResourceDto,
        ),

        catchError(
          error => {

            const mapped =
              mapHttpError(
                error,
              );

            return mapped.status ===
              404
              ? of(
                  undefined,
                )
              : throwError(
                  () =>
                    mapped,
                );
          },
        ),
      );
  }

  assignIncident(
    incidentId: string,

    attendantId: string,
  ):
    Observable<
      IncidentRecord
    > {

    const body:
      AssignIncidentResourceDto = {

      attendantId,
    };

    return this.http
      .patch<
        IncidentResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.incidentsPath}/${incidentId}/assign`,
        ),

        body,
      )
      .pipe(

        map(
          mapIncidentResourceDto,
        ),

        catchError(
          error =>
            throwError(
              () =>
                mapHttpError(
                  error,
                ),
            ),
        ),
      );
  }

  resolveIncident(
    incidentId: string,

    resolutionNotes: string,
  ):
    Observable<
      IncidentRecord
    > {

    const body:
      ResolveIncidentResourceDto = {

      resolutionNotes,
    };

    return this.http
      .patch<
        IncidentResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.incidentsPath}/${incidentId}/resolve`,
        ),

        body,
      )
      .pipe(

        map(
          mapIncidentResourceDto,
        ),

        catchError(
          error =>
            throwError(
              () =>
                mapHttpError(
                  error,
                ),
            ),
        ),
      );
  }
}