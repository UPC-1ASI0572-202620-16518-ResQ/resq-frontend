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
  PageRequest,
  PagedResult,
} from '../../../core/api/pagination';

import {
  AddZoneToBuildingResourceDto,
  BuildingPageResourceDto,
  BuildingResourceDto,
  ChangeBuildingAdministrativeStatusResourceDto,
  ChangeZoneAdministrativeStatusResourceDto,
  RegisterBuildingResourceDto,
  UpdateBuildingDetailsResourceDto,
  UpdateZoneResourceDto,
  ZonePageResourceDto,
  ZoneResourceDto,
} from './building.dto';

import {
  BuildingCatalogRecord,
  BuildingGateway,
  BuildingQueryFilters,
  VersionedBuildingCatalogRecord,
  ZoneCatalogRecord,
  ZoneQueryFilters,
} from './building.gateway';

import {
  mapBuildingPageResourceDto,
  mapBuildingResourceDto,
  mapZonePageResourceDto,
  mapZoneResourceDto,
  withBuildingEtag,
} from './building.mapper';

@Injectable()
export class HttpBuildingGateway
  implements BuildingGateway {

  private readonly buildingsPath =
    '/api/v1/buildings';

  constructor(

    private readonly http:
      HttpClient,

    @Inject(API_CONFIG)
    private readonly apiConfig:
      ApiConfig,
  ) {}

  getBuildings(
    filters:
      BuildingQueryFilters,

    page:
      PageRequest,
  ):
    Observable<
      PagedResult<
        BuildingCatalogRecord
      >
    > {

    let params =
      pageParams(
        page,
      );

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
      .get<
        BuildingPageResourceDto
      >(
        buildApiUrl(
          this.apiConfig,
          this.buildingsPath,
        ),

        {
          params,
        },
      )
      .pipe(

        map(
          mapBuildingPageResourceDto,
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

  getBuildingById(
    buildingId: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
      | undefined
    > {

    return this.http
      .get<
        BuildingResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.buildingsPath}/${buildingId}`,
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

  getZonesByBuildingId(
    buildingId: string,

    filters:
      ZoneQueryFilters,

    page:
      PageRequest,
  ):
    Observable<
      PagedResult<
        ZoneCatalogRecord
      >
    > {

    let params =
      pageParams(
        page,
      );

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
      .get<
        ZonePageResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.buildingsPath}/${buildingId}/zones`,
        ),

        {
          params,
        },
      )
      .pipe(

        map(
          mapZonePageResourceDto,
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

  getZoneById(
    buildingId: string,

    zoneId: string,
  ):
    Observable<
      ZoneCatalogRecord
      | undefined
    > {

    return this.http
      .get<
        ZoneResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.buildingsPath}/${buildingId}/zones/${zoneId}`,
        ),
      )
      .pipe(

        map(
          mapZoneResourceDto,
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

  registerBuilding(
    resource:
      RegisterBuildingResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    return this.http
      .post<
        BuildingResourceDto
      >(
        buildApiUrl(
          this.apiConfig,
          this.buildingsPath,
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

  updateBuildingDetails(
    buildingId: string,

    resource:
      UpdateBuildingDetailsResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    return this.put(

      `${this.buildingsPath}/${buildingId}/details`,

      resource,

      etag,
    );
  }

  changeBuildingAdministrativeStatus(
    buildingId: string,

    resource:
      ChangeBuildingAdministrativeStatusResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    return this.put(

      `${this.buildingsPath}/${buildingId}/administrative-status`,

      resource,

      etag,
    );
  }

  addZoneToBuilding(
    buildingId: string,

    resource:
      AddZoneToBuildingResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    const headers =
      new HttpHeaders({
        'If-Match':
          etag,
      });

    return this.http
      .post<
        BuildingResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.buildingsPath}/${buildingId}/zones`,
        ),

        resource,

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

  updateZone(
    buildingId: string,

    zoneId: string,

    resource:
      UpdateZoneResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    return this.put(

      `${this.buildingsPath}/${buildingId}/zones/${zoneId}/details`,

      resource,

      etag,
    );
  }

  changeZoneAdministrativeStatus(
    buildingId: string,

    zoneId: string,

    resource:
      ChangeZoneAdministrativeStatusResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    return this.put(

      `${this.buildingsPath}/${buildingId}/zones/${zoneId}/administrative-status`,

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
      VersionedBuildingCatalogRecord
    > {

    const headers =
      new HttpHeaders({
        'If-Match':
          etag,
      });

    return this.http
      .put<
        BuildingResourceDto
      >(
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
      HttpResponse<
        BuildingResourceDto
      >,
  ):
    VersionedBuildingCatalogRecord {

    if (
      !response.body
    ) {

      throw new Error(
        'The Buildings API returned an empty response body.',
      );
    }

    return withBuildingEtag(

      mapBuildingResourceDto(
        response.body,
      ),

      response.headers.get(
        'ETag',
      ),
    );
  }
}

function pageParams(
  page:
    PageRequest,
):
  HttpParams {

  return new HttpParams()
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
}