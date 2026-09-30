import {
  HttpClient,
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
  SensorConnectionResourceDto,
} from './connectivity.dto';

import {
  ConnectivityGateway,
  DeviceConnectionState,
} from './connectivity.gateway';

import {
  mapSensorConnectionResourceDto,
} from './connectivity.mapper';

@Injectable()
export class HttpConnectivityGateway
  implements ConnectivityGateway {

  private readonly connectivityPath =
    '/api/v1/connectivity';

  constructor(

    private readonly http:
      HttpClient,

    @Inject(API_CONFIG)
    private readonly apiConfig:
      ApiConfig,
  ) {}

  getDeviceConnectionStatus(
    deviceId: string,
  ):
    Observable<
      DeviceConnectionState
      | undefined
    > {

    const path =
      `${this.connectivityPath}` +
      `/sensors/${deviceId}/status`;

    return this.http
      .get<SensorConnectionResourceDto>(
        buildApiUrl(
          this.apiConfig,
          path,
        ),
      )
      .pipe(

        map(
          mapSensorConnectionResourceDto,
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

  getOfflineDevices():
    Observable<
      DeviceConnectionState[]
    > {

    const path =
      `${this.connectivityPath}` +
      '/sensors/offline';

    return this.http
      .get<
        SensorConnectionResourceDto[]
      >(
        buildApiUrl(
          this.apiConfig,
          path,
        ),
      )
      .pipe(

        map(
          resources =>
            resources.map(
              mapSensorConnectionResourceDto,
            ),
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