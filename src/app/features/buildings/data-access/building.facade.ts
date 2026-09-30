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
  AddZoneToBuildingResourceDto,
  ChangeBuildingAdministrativeStatusResourceDto,
  ChangeZoneAdministrativeStatusResourceDto,
  RegisterBuildingResourceDto,
  UpdateBuildingDetailsResourceDto,
  UpdateZoneResourceDto,
} from './building.dto';

import {
  BUILDING_GATEWAY,
  BuildingCatalogRecord,
  BuildingGateway,
  BuildingQueryFilters,
  VersionedBuildingCatalogRecord,
  ZoneCatalogRecord,
  ZoneQueryFilters,
} from './building.gateway';

const EMPTY_BUILDING_PAGE:
  PagedResult<
    BuildingCatalogRecord
  > = {

  items: [],

  page: 0,

  size: 20,

  totalElements: 0,

  totalPages: 0,
};

const EMPTY_ZONE_PAGE:
  PagedResult<
    ZoneCatalogRecord
  > = {

  items: [],

  page: 0,

  size: 20,

  totalElements: 0,

  totalPages: 0,
};

@Injectable()
export class BuildingFacade {

  private readonly pageState =
    signal(
      EMPTY_BUILDING_PAGE,
    );

  private readonly zonePageState =
    signal(
      EMPTY_ZONE_PAGE,
    );

  private readonly selectedState =
    signal<
      VersionedBuildingCatalogRecord
      | undefined
    >(
      undefined,
    );

  private readonly selectedZoneState =
    signal<
      ZoneCatalogRecord
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

  readonly buildings =
    computed(
      () =>
        this.pageState()
          .items,
    );

  readonly zonePage =
    this.zonePageState
      .asReadonly();

  readonly zones =
    computed(
      () =>
        this.zonePageState()
          .items,
    );

  readonly selected =
    computed(
      () =>
        this.selectedState()
          ?.building,
    );

  readonly selectedEtag =
    computed(
      () =>
        this.selectedState()
          ?.etag,
    );

  readonly selectedZone =
    this.selectedZoneState
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
      BUILDING_GATEWAY,
    )

    private readonly gateway:
      BuildingGateway,
  ) {}

  loadBuildings(
    filters:
      BuildingQueryFilters = {},

    page:
      PageRequest = {
        page: 0,
        size: 20,
      },
  ):
    Observable<
      PagedResult<
        BuildingCatalogRecord
      >
    > {

    this.beginLoad();

    return this.gateway
      .getBuildings(
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

  loadBuilding(
    buildingId: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getBuildingById(
        buildingId,
      )
      .pipe(

        tap(
          result =>
            this.selectedState.set(
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

  loadZones(
    buildingId: string,

    filters:
      ZoneQueryFilters = {},

    page:
      PageRequest = {
        page: 0,
        size: 100,
      },
  ):
    Observable<
      PagedResult<
        ZoneCatalogRecord
      >
    > {

    this.beginLoad();

    return this.gateway
      .getZonesByBuildingId(
        buildingId,
        filters,
        page,
      )
      .pipe(

        tap(
          result =>
            this.zonePageState.set(
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

  loadZone(
    buildingId: string,

    zoneId: string,
  ):
    Observable<
      ZoneCatalogRecord
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getZoneById(
        buildingId,
        zoneId,
      )
      .pipe(

        tap(
          zone =>
            this.selectedZoneState.set(
              zone,
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

  registerBuilding(
    resource:
      RegisterBuildingResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    return this.mutate(
      this.gateway
        .registerBuilding(
          resource,
        ),
    );
  }

  updateBuildingDetails(
    resource:
      UpdateBuildingDetailsResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .updateBuildingDetails(

          selected
            .building
            .id,

          resource,

          selected.etag,
        ),
    );
  }

  changeBuildingAdministrativeStatus(
    resource:
      ChangeBuildingAdministrativeStatusResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .changeBuildingAdministrativeStatus(

          selected
            .building
            .id,

          resource,

          selected.etag,
        ),
    );
  }

  addZone(
    resource:
      AddZoneToBuildingResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .addZoneToBuilding(

          selected
            .building
            .id,

          resource,

          selected.etag,
        ),
    );
  }

  updateZone(
    zoneId: string,

    resource:
      UpdateZoneResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .updateZone(

          selected
            .building
            .id,

          zoneId,

          resource,

          selected.etag,
        ),
    );
  }

  changeZoneAdministrativeStatus(
    zoneId: string,

    resource:
      ChangeZoneAdministrativeStatusResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .changeZoneAdministrativeStatus(

          selected
            .building
            .id,

          zoneId,

          resource,

          selected.etag,
        ),
    );
  }

  clearError(): void {

    this.errorState.set(
      undefined,
    );
  }

  clearSelected(): void {

    this.selectedState.set(
      undefined,
    );

    this.selectedZoneState.set(
      undefined,
    );
  }

  private mutate(
    operation:
      Observable<
        VersionedBuildingCatalogRecord
      >,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return operation.pipe(

      tap(
        result => {

          this.selectedState.set(
            result,
          );

          this.pageState.update(
            page => ({

              ...page,

              items:
                page.items.some(
                  item =>
                    item.id ===
                    result.building.id,
                )
                  ? page.items.map(
                      item =>
                        item.id ===
                        result.building.id
                          ? result.building
                          : item,
                    )
                  : [
                      ...page.items,
                      result.building,
                    ],
            }),
          );

          this.zonePageState.update(
            page => ({

              ...page,

              items:
                result
                  .building
                  .zones,

              totalElements:
                result
                  .building
                  .zones
                  .length,

              totalPages:
                result
                  .building
                  .zones
                  .length
                  ? 1
                  : 0,
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

  private requireSelected(): {
    building:
      BuildingCatalogRecord;

    etag:
      string;
  } {

    const selected =
      this.selectedState();

    if (!selected) {

      throw new Error(
        'A building must be loaded before it can be modified.',
      );
    }

    if (!selected.etag) {

      throw <ApiError>{
        status: 428,

        code:
          'PRECONDITION_REQUIRED',

        message:
          'The latest building version is required before making changes.',

        fieldErrors: [],
      };
    }

    return {
      building:
        selected.building,

      etag:
        selected.etag,
    };
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