import {
  Inject,
  Injectable,
  computed,
  signal,
} from '@angular/core';

import {
  Observable,
  catchError,
  finalize,
  tap,
  throwError,
} from 'rxjs';

import {
  ApiError,
  isApiError,
} from '../../../core/api/api-error';

import {
  PageRequest,
  PagedResult,
} from '../../../core/api/pagination';

import {
  INCIDENT_GATEWAY,
  IncidentGateway,
  IncidentQueryFilters,
  IncidentRecord,
} from './incident.gateway';

const EMPTY_PAGE:
  PagedResult<
    IncidentRecord
  > = {

  items: [],

  page: 0,

  size: 20,

  totalElements: 0,

  totalPages: 0,
};

@Injectable()
export class IncidentFacade {

  private readonly pageState =
    signal<
      PagedResult<
        IncidentRecord
      >
    >(
      EMPTY_PAGE,
    );

  private readonly selectedState =
    signal<
      IncidentRecord
      | undefined
    >(
      undefined,
    );

  private readonly loadingState =
    signal(
      false,
    );

  private readonly savingState =
    signal(
      false,
    );

  private readonly errorState =
    signal<
      ApiError
      | undefined
    >(
      undefined,
    );

  readonly page =
    this.pageState
      .asReadonly();

  readonly incidents =
    computed(
      () =>
        this.pageState()
          .items,
    );

  readonly selected =
    this.selectedState
      .asReadonly();

  readonly loading =
    this.loadingState
      .asReadonly();

  readonly saving =
    this.savingState
      .asReadonly();

  readonly error =
    this.errorState
      .asReadonly();

  constructor(

    @Inject(
      INCIDENT_GATEWAY,
    )

    private readonly gateway:
      IncidentGateway,
  ) {}

  loadIncidents(
    filters:
      IncidentQueryFilters = {},

    page:
      PageRequest = {
        page: 0,
        size: 20,
      },
  ):
    Observable<
      PagedResult<
        IncidentRecord
      >
    > {

    this.beginLoad();

    return this.gateway
      .getIncidents(
        filters,
        page,
      )
      .pipe(

        tap(
          result =>
            this.pageState.set(
              result,
            ),
        ),

        catchError(
          error =>
            this.fail(
              error,
            ),
        ),

        finalize(
          () =>
            this.endLoad(),
        ),
      );
  }

  loadIncident(
    incidentId: string,
  ):
    Observable<
      IncidentRecord
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getIncidentById(
        incidentId,
      )
      .pipe(

        tap(
          incident =>
            this.selectedState.set(
              incident,
            ),
        ),

        catchError(
          error =>
            this.fail(
              error,
            ),
        ),

        finalize(
          () =>
            this.endLoad(),
        ),
      );
  }

  assignIncident(
    attendantId: string,
  ):
    Observable<
      IncidentRecord
    > {

    const incident =
      this.requireSelected();

    return this.mutate(
      this.gateway
        .assignIncident(
          incident.incidentId,
          attendantId,
        ),
    );
  }

  resolveIncident(
    resolutionNotes: string,
  ):
    Observable<
      IncidentRecord
    > {

    const incident =
      this.requireSelected();

    return this.mutate(
      this.gateway
        .resolveIncident(
          incident.incidentId,
          resolutionNotes,
        ),
    );
  }

  canAssign(
    incident:
      IncidentRecord,
  ): boolean {

    return (
      incident.status ===
        'ACTIVE' ||
      incident.status ===
        'IN_PROGRESS'
    );
  }

  canResolve(
    incident:
      IncidentRecord,
  ): boolean {

    return (
      incident.status ===
        'ACTIVE' ||
      incident.status ===
        'IN_PROGRESS'
    );
  }

  isReadOnly(
    incident:
      IncidentRecord,
  ): boolean {

    return (
      incident.status ===
        'RESOLVED' ||
      incident.status ===
        'CLOSED'
    );
  }

  clearSelected(): void {

    this.selectedState.set(
      undefined,
    );
  }

  clearError(): void {

    this.errorState.set(
      undefined,
    );
  }

  private mutate(
    operation:
      Observable<
        IncidentRecord
      >,
  ):
    Observable<
      IncidentRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return operation.pipe(

      tap(
        incident => {

          this.selectedState.set(
            incident,
          );

          this.pageState.update(
            page => ({

              ...page,

              items:
                page.items.map(
                  item =>
                    item.incidentId ===
                    incident.incidentId
                      ? incident
                      : item,
                ),
            }),
          );
        },
      ),

      catchError(
        error =>
          this.fail(
            error,
          ),
      ),

      finalize(
        () =>
          this.savingState.set(
            false,
          ),
      ),
    );
  }

  private requireSelected():
    IncidentRecord {

    const incident =
      this.selectedState();

    if (!incident) {

      throw new Error(
        'An incident must be loaded before it can be modified.',
      );
    }

    return incident;
  }

  private beginLoad(): void {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );
  }

  private endLoad(): void {

    this.loadingState.set(
      false,
    );
  }

  private fail(
    error: unknown,
  ):
    Observable<never> {

    const apiError:
      ApiError =
      isApiError(
        error,
      )
        ? error
        : {
            status:
              0,

            code:
              'CLIENT_ERROR',

            message:
              error instanceof Error
                ? error.message
                : 'An unexpected client error occurred.',

            fieldErrors:
              [],

            details:
              error,
          };

    this.errorState.set(
      apiError,
    );

    return throwError(
      () =>
        apiError,
    );
  }
}