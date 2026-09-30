import {
  Inject,
  Injectable,
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
  BuildingMonitoringStatus,
  CurrentMeasurementsQuery,
  DeviceMonitoringState,
  MeasurementTimeRange,
  MONITORING_GATEWAY,
  MonitoringGateway,
  MonitoringMeasurement,
  ZoneMonitoringState,
} from './monitoring.gateway';

@Injectable()
export class MonitoringFacade {

  private readonly loadingState =
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

  private readonly buildingState =
    signal<
      BuildingMonitoringStatus
      | undefined
    >(
      undefined,
    );

  private readonly zoneState =
    signal<
      ZoneMonitoringState
      | undefined
    >(
      undefined,
    );

  private readonly deviceState =
    signal<
      DeviceMonitoringState
      | undefined
    >(
      undefined,
    );

  private readonly measurementsState =
    signal<
      MonitoringMeasurement[]
    >(
      [],
    );

  readonly loading =
    this.loadingState
      .asReadonly();

  readonly error =
    this.errorState
      .asReadonly();

  readonly buildingStatus =
    this.buildingState
      .asReadonly();

  readonly zoneStatus =
    this.zoneState
      .asReadonly();

  readonly deviceStatus =
    this.deviceState
      .asReadonly();

  readonly measurements =
    this.measurementsState
      .asReadonly();

  constructor(

    @Inject(
      MONITORING_GATEWAY,
    )

    private readonly gateway:
      MonitoringGateway,
  ) {}

  loadBuildingStatus(
    buildingId: string,
  ):
    Observable<
      BuildingMonitoringStatus
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getBuildingStatus(
        buildingId,
      )
      .pipe(

        tap(
          state =>
            this.buildingState.set(
              state,
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

  loadZoneStatus(
    zoneId: string,
  ):
    Observable<
      ZoneMonitoringState
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getZoneStatus(
        zoneId,
      )
      .pipe(

        tap(
          state =>
            this.zoneState.set(
              state,
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

  loadDeviceStatus(
    deviceId: string,
  ):
    Observable<
      DeviceMonitoringState
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getDeviceStatus(
        deviceId,
      )
      .pipe(

        tap(
          state =>
            this.deviceState.set(
              state,
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

  loadCurrentMeasurements(
    query:
      CurrentMeasurementsQuery,
  ):
    Observable<
      MonitoringMeasurement[]
    > {

    this.beginLoad();

    return this.gateway
      .getCurrentMeasurements(
        query,
      )
      .pipe(

        tap(
          measurements =>
            this.measurementsState.set(
              measurements,
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

  loadDeviceMeasurements(
    deviceId: string,

    range?:
      MeasurementTimeRange,
  ):
    Observable<
      MonitoringMeasurement[]
    > {

    this.beginLoad();

    return this.gateway
      .getDeviceMeasurements(
        deviceId,
        range,
      )
      .pipe(

        tap(
          measurements =>
            this.measurementsState.set(
              measurements,
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

  clearError(): void {

    this.errorState.set(
      undefined,
    );
  }

  clearMeasurements(): void {

    this.measurementsState.set(
      [],
    );
  }

  private beginLoad():
    void {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );
  }

  private endLoad():
    void {

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
            status: 0,

            code:
              'CLIENT_ERROR',

            message:
              error instanceof Error
                ? error.message
                : 'An unexpected client error occurred.',

            fieldErrors: [],

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