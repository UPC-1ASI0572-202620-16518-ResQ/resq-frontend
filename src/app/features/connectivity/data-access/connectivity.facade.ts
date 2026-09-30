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
  CONNECTIVITY_GATEWAY,
  ConnectivityGateway,
  DeviceConnectionState,
} from './connectivity.gateway';

@Injectable()
export class ConnectivityFacade {

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

  private readonly selectedState =
    signal<
      DeviceConnectionState
      | undefined
    >(
      undefined,
    );

  private readonly offlineState =
    signal<
      DeviceConnectionState[]
    >(
      [],
    );

  readonly loading =
    this.loadingState
      .asReadonly();

  readonly error =
    this.errorState
      .asReadonly();

  readonly selected =
    this.selectedState
      .asReadonly();

  readonly offlineDevices =
    this.offlineState
      .asReadonly();

  constructor(

    @Inject(
      CONNECTIVITY_GATEWAY,
    )

    private readonly gateway:
      ConnectivityGateway,
  ) {}

  loadDeviceConnection(
    deviceId: string,
  ):
    Observable<
      DeviceConnectionState
      | undefined
    > {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .getDeviceConnectionStatus(
        deviceId,
      )
      .pipe(

        tap(
          connection =>
            this.selectedState.set(
              connection,
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
            this.loadingState.set(
              false,
            ),
        ),
      );
  }

  loadOfflineDevices():
    Observable<
      DeviceConnectionState[]
    > {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .getOfflineDevices()
      .pipe(

        tap(
          devices =>
            this.offlineState.set(
              devices,
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
            this.loadingState.set(
              false,
            ),
        ),
      );
  }

  clearError(): void {

    this.errorState.set(
      undefined,
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