import {
  HttpClient,
  HttpHeaders,
  HttpParams,
  HttpResponse,
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
  PagedResult,
  PageRequest,
} from '../../../core/api/pagination';

import {
  AssignDeviceToLocationResourceDto,
  ChangeDeviceAdministrativeStatusResourceDto,
  DevicePageResourceDto,
  DeviceResourceDto,
  RegisterDeviceResourceDto,
  ReplaceDeviceCapabilitiesResourceDto,
  UpdateDeviceDetailsResourceDto,
} from './device.dto';

import {
  DeviceCatalogRecord,
  DeviceGateway,
  DeviceQueryFilters,
  ExternalDeviceReferenceQuery,
  VersionedDeviceCatalogRecord,
} from './device.gateway';

import {
  mapDevicePageResourceDto,
  mapDeviceResourceDto,
  withEtag,
} from './device.mapper';

@Injectable()
export class HttpDeviceGateway
  implements DeviceGateway {

  private readonly devicesPath =
    '/api/v1/devices';

  constructor(

    private readonly http:
      HttpClient,

    @Inject(API_CONFIG)
    private readonly apiConfig:
      ApiConfig,
  ) {}

  getDevices(
    filters:
      DeviceQueryFilters,

    page:
      PageRequest,
  ):
    Observable<
      PagedResult<DeviceCatalogRecord>
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
      filters.buildingId
    ) {

      params =
        params.set(
          'buildingId',
          filters.buildingId,
        );
    }

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
      filters
        .administrativeStatus
    ) {

      params =
        params.set(
          'administrativeStatus',

          filters
            .administrativeStatus,
        );
    }

    return this.http
      .get<DevicePageResourceDto>(
        buildApiUrl(
          this.apiConfig,
          this.devicesPath,
        ),

        {
          params,
        },
      )
      .pipe(

        map(
          mapDevicePageResourceDto,
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

  getDeviceById(
    deviceId: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
      | undefined
    > {

    return this.http
      .get<DeviceResourceDto>(
        buildApiUrl(
          this.apiConfig,

          `${this.devicesPath}/${deviceId}`,
        ),

        {
          observe:
            'response',
        },
      )
      .pipe(

        map(
          response =>
            this.mapVersionedResponse(
              response,
            ),
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

  getDeviceByExternalReference(
    reference:
      ExternalDeviceReferenceQuery,
  ):
    Observable<
      VersionedDeviceCatalogRecord
      | undefined
    > {

    const params =
      new HttpParams()
        .set(
          'sourceSystem',

          reference
            .sourceSystem,
        )
        .set(
          'externalDeviceId',

          reference
            .externalDeviceId,
        );

    return this.http
      .get<DeviceResourceDto>(
        buildApiUrl(
          this.apiConfig,

          `${this.devicesPath}/by-external-reference`,
        ),

        {
          params,

          observe:
            'response',
        },
      )
      .pipe(

        map(
          response =>
            this.mapVersionedResponse(
              response,
            ),
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

  registerDevice(
    resource:
      RegisterDeviceResourceDto,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    return this.http
      .post<DeviceResourceDto>(
        buildApiUrl(
          this.apiConfig,
          this.devicesPath,
        ),

        resource,

        {
          observe:
            'response',
        },
      )
      .pipe(

        map(
          response =>
            this.mapVersionedResponse(
              response,
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

  updateDeviceDetails(
    deviceId: string,

    resource:
      UpdateDeviceDetailsResourceDto,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    return this.put(
      `${this.devicesPath}/${deviceId}/details`,

      resource,

      etag,
    );
  }

  replaceDeviceCapabilities(
    deviceId: string,

    resource:
      ReplaceDeviceCapabilitiesResourceDto,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    return this.put(
      `${this.devicesPath}/${deviceId}/capabilities`,

      resource,

      etag,
    );
  }

  assignDeviceToLocation(
    deviceId: string,

    resource:
      AssignDeviceToLocationResourceDto,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    return this.put(
      `${this.devicesPath}/${deviceId}/assignment`,

      resource,

      etag,
    );
  }

  changeDeviceAdministrativeStatus(
    deviceId: string,

    resource:
      ChangeDeviceAdministrativeStatusResourceDto,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    return this.put(
      `${this.devicesPath}/${deviceId}/administrative-status`,

      resource,

      etag,
    );
  }

  private put<TBody>(
    path: string,

    body: TBody,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    const headers =
      new HttpHeaders({
        'If-Match':
          etag,
      });

    return this.http
      .put<DeviceResourceDto>(
        buildApiUrl(
          this.apiConfig,
          path,
        ),

        body,

        {
          headers,

          observe:
            'response',
        },
      )
      .pipe(

        map(
          response =>
            this.mapVersionedResponse(
              response,
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

  private mapVersionedResponse(
    response:
      HttpResponse<DeviceResourceDto>,
  ):
    VersionedDeviceCatalogRecord {

    if (
      !response.body
    ) {

      throw new Error(
        'The Device API returned an empty response body.',
      );
    }

    return withEtag(

      mapDeviceResourceDto(
        response.body,
      ),

      response.headers.get(
        'ETag',
      ),
    );
  }
}