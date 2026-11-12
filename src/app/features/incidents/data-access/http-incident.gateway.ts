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
  switchMap,
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
  IncidentResourceDto,
  ResolveIncidentResourceDto,
  UpdateIncidentStatusResourceDto,
} from './incident.dto';

import {
  IncidentGateway,
  IncidentQueryFilters,
  IncidentRecord,
} from './incident.gateway';

import {
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

    let params = new HttpParams();

    if (
      filters.zoneId
    ) {

      params =
        params.set(
          'zoneId',
          filters.zoneId,
        );
    }

    return this.http
      .get<
        IncidentResourceDto[]
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

        map((resources) => {
          let items = resources.map(mapIncidentResourceDto);
          if (filters.type) items = items.filter((item) => item.type === filters.type);
          if (filters.status) items = items.filter((item) => item.status === filters.status);
          if (filters.startDate) items = items.filter((item) => item.createdAt >= filters.startDate!);
          if (filters.endDate) items = items.filter((item) => item.createdAt <= filters.endDate!);
          const size = Math.min(100, Math.max(1, Math.trunc(page.size || 20)));
          const currentPage = Math.max(0, Math.trunc(page.page));
          const totalElements = items.length;
          return {
            items: items.slice(currentPage * size, (currentPage + 1) * size),
            page: currentPage,
            size,
            totalElements,
            totalPages: Math.ceil(totalElements / size),
          };
        }),

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

        map(mapIncidentResourceDto),

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
      .put<
        IncidentResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.incidentsPath}/${incidentId}/assign`,
        ),

        body,
      )
      .pipe(

        switchMap(() => this.requireIncident(incidentId)),

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
      .put<
        IncidentResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.incidentsPath}/${incidentId}/resolve`,
        ),

        body,
      )
      .pipe(

        switchMap(() => this.requireIncident(incidentId)),

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

  closeIncident(incidentId: string): Observable<IncidentRecord> {
    const body: UpdateIncidentStatusResourceDto = { status: 'Closed' };
    return this.http
      .put<void>(
        buildApiUrl(this.apiConfig, `${this.incidentsPath}/${incidentId}/status`),
        body,
      )
      .pipe(
        switchMap(() => this.requireIncident(incidentId)),
        catchError((error) => throwError(() => mapHttpError(error))),
      );
  }

  private requireIncident(incidentId: string): Observable<IncidentRecord> {
    return this.getIncidentById(incidentId).pipe(
      switchMap((incident) => incident
        ? of(incident)
        : throwError(() => ({
            status: 404,
            code: 'NOT_FOUND',
            message: 'Incident was not found after the operation.',
            fieldErrors: [],
          }))),
    );
  }
}
