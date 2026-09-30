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
  BUILDINGS,
} from '../../../core/mock-data/resq.mock';

import {
  AddZoneToBuildingResourceDto,
  ChangeBuildingAdministrativeStatusResourceDto,
  ChangeZoneAdministrativeStatusResourceDto,
  RegisterBuildingResourceDto,
  UpdateBuildingDetailsResourceDto,
  UpdateZoneResourceDto,
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
  buildingEtagForVersion,
  buildingVersionFromEtag,
  mapLegacyBuildingToCatalog,
  withBuildingEtag,
} from './building.mapper';

@Injectable()
export class MockBuildingGateway
  implements BuildingGateway {

  private readonly items =
    signal<
      BuildingCatalogRecord[]
    >(
      BUILDINGS.map(
        mapLegacyBuildingToCatalog,
      ),
    );

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

    const filtered =
      this.items()
        .filter(
          building =>
            !filters
              .administrativeStatus ||
            building
              .administrativeStatus ===
              filters
                .administrativeStatus,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.createdAt
              .getTime() -
              right.createdAt
                .getTime() ||
            left.id.localeCompare(
              right.id,
            ),
        );

    return of(
      paginateInMemory(
        filtered.map(
          cloneBuilding,
        ),

        normalizePage(
          page,
        ),
      ),
    ).pipe(
      delay(80),
    );
  }

  getBuildingById(
    buildingId: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
      | undefined
    > {

    const building =
      this.items().find(
        item =>
          item.id ===
          buildingId,
      );

    return of(
      building
        ? withBuildingEtag(
            cloneBuilding(
              building,
            ),
          )
        : undefined,
    ).pipe(
      delay(60),
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

    const building =
      this.items().find(
        item =>
          item.id ===
          buildingId,
      );

    const zones =
      (
        building?.zones ??
        []
      )
        .filter(
          zone =>
            !filters
              .administrativeStatus ||
            zone
              .administrativeStatus ===
              filters
                .administrativeStatus,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.createdAt
              .getTime() -
              right.createdAt
                .getTime() ||
            left.id.localeCompare(
              right.id,
            ),
        )
        .map(
          cloneZone,
        );

    return of(
      paginateInMemory(
        zones,

        normalizePage(
          page,
        ),
      ),
    ).pipe(
      delay(70),
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

    const zone =
      this.items()
        .find(
          item =>
            item.id ===
            buildingId,
        )
        ?.zones.find(
          item =>
            item.id ===
            zoneId,
        );

    return of(
      zone
        ? cloneZone(
            zone,
          )
        : undefined,
    ).pipe(
      delay(60),
    );
  }

  registerBuilding(
    resource:
      RegisterBuildingResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    const error =
      validateBuildingRegistration(
        resource,
      );

    if (error) {

      return throwError(
        () =>
          error,
      );
    }

    const buildingCode =
      normalizeCode(
        resource.buildingCode,
      );

    if (
      this.items().some(
        item =>
          item.buildingCode ===
          buildingCode,
      )
    ) {

      return throwError(
        () =>
          conflict(
            'BUILDING_CODE_ALREADY_EXISTS',

            'Building code is already registered.',
          ),
      );
    }

    const now =
      new Date();

    const building:
      BuildingCatalogRecord = {

      id:
        createLocalId(
          'building',
        ),

      organizationId:
        'securitybear',

      buildingCode,

      name:
        resource.name.trim(),

      description:
        optionalText(
          resource.description,
        ),

      address:
        normalizeAddress(
          resource.address,
        ),

      administrativeStatus:
        'ACTIVE',

      zones: [],

      createdAt:
        now,

      updatedAt:
        now,

      version:
        1,
    };

    this.items.update(
      items => [
        ...items,
        building,
      ],
    );

    return of(
      withBuildingEtag(
        cloneBuilding(
          building,
        ),
      ),
    ).pipe(
      delay(100),
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

    return this.updateBuilding(

      buildingId,

      etag,

      building => {

        const error =
          validateBuildingDetails(
            resource,
          );

        if (error) {
          throw error;
        }

        return {
          ...building,

          name:
            resource.name.trim(),

          description:
            optionalText(
              resource.description,
            ),

          address:
            normalizeAddress(
              resource.address,
            ),
        };
      },
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

    return this.updateBuilding(

      buildingId,

      etag,

      building => ({

        ...building,

        administrativeStatus:
          resource
            .administrativeStatus,

        zones:
          building.zones.map(
            zone => ({

              ...zone,

              availableForAssignment:
                resource
                  .administrativeStatus ===
                  'ACTIVE' &&
                zone
                  .administrativeStatus ===
                  'ACTIVE',
            }),
          ),
      }),
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

    return this.updateBuilding(

      buildingId,

      etag,

      building => {

        if (
          building
            .administrativeStatus !==
          'ACTIVE'
        ) {

          throw conflict(
            'BUILDING_INACTIVE',

            'A zone can only be added to an ACTIVE building.',
          );
        }

        const error =
          validateZoneDefinition(
            resource,
          );

        if (error) {
          throw error;
        }

        const zoneCode =
          normalizeCode(
            resource.zoneCode,
          );

        if (
          building.zones.some(
            zone =>
              zone.zoneCode ===
              zoneCode,
          )
        ) {

          throw conflict(
            'ZONE_CODE_ALREADY_EXISTS',

            'Zone code is already registered in this building.',
          );
        }

        const now =
          new Date();

        const zone:
          ZoneCatalogRecord = {

          id:
            createLocalId(
              'zone',
            ),

          buildingId,

          zoneCode,

          name:
            resource.name.trim(),

          description:
            optionalText(
              resource.description,
            ),

          floorLabel:
            optionalText(
              resource.floorLabel,
            ),

          administrativeStatus:
            'ACTIVE',

          availableForAssignment:
            true,

          createdAt:
            now,

          updatedAt:
            now,
        };

        return {
          ...building,

          zones: [
            ...building.zones,
            zone,
          ],
        };
      },
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

    return this.updateBuilding(

      buildingId,

      etag,

      building => {

        const zone =
          building.zones.find(
            item =>
              item.id ===
              zoneId,
          );

        if (!zone) {
          throw zoneNotFound();
        }

        const error =
          validateZoneDetails(
            resource,
          );

        if (error) {
          throw error;
        }

        return {
          ...building,

          zones:
            building.zones.map(
              item =>
                item.id ===
                zoneId
                  ? {
                      ...item,

                      name:
                        resource
                          .name
                          .trim(),

                      description:
                        optionalText(
                          resource
                            .description,
                        ),

                      floorLabel:
                        optionalText(
                          resource
                            .floorLabel,
                        ),

                      updatedAt:
                        new Date(),
                    }
                  : item,
            ),
        };
      },
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

    return this.updateBuilding(

      buildingId,

      etag,

      building => {

        const zone =
          building.zones.find(
            item =>
              item.id ===
              zoneId,
          );

        if (!zone) {
          throw zoneNotFound();
        }

        if (
          resource
            .administrativeStatus ===
            'ACTIVE' &&
          building
            .administrativeStatus !==
            'ACTIVE'
        ) {

          throw conflict(
            'BUILDING_INACTIVE',

            'A zone cannot be activated while its building is INACTIVE.',
          );
        }

        return {
          ...building,

          zones:
            building.zones.map(
              item =>
                item.id ===
                zoneId
                  ? {
                      ...item,

                      administrativeStatus:
                        resource
                          .administrativeStatus,

                      availableForAssignment:
                        resource
                          .administrativeStatus ===
                          'ACTIVE' &&
                        building
                          .administrativeStatus ===
                          'ACTIVE',

                      updatedAt:
                        new Date(),
                    }
                  : item,
            ),
        };
      },
    );
  }

  private updateBuilding(
    buildingId: string,

    etag: string,

    transform:
      (
        building:
          BuildingCatalogRecord,
      ) =>
        BuildingCatalogRecord,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    > {

    const current =
      this.items().find(
        item =>
          item.id ===
          buildingId,
      );

    if (!current) {

      return throwError(
        () =>
          buildingNotFound(),
      );
    }

    const expectedVersion =
      buildingVersionFromEtag(
        etag,
      );

    if (!expectedVersion) {

      return throwError(
        () =>
          preconditionRequired(),
      );
    }

    if (
      expectedVersion !==
      current.version
    ) {

      return throwError(
        () =>
          preconditionFailed(),
      );
    }

    try {

      const transformed =
        transform(
          cloneBuilding(
            current,
          ),
        );

      const changed =
        JSON.stringify(
          toComparable(
            current,
          ),
        ) !==
        JSON.stringify(
          toComparable(
            transformed,
          ),
        );

      const next =
        changed
          ? {
              ...transformed,

              updatedAt:
                new Date(),

              version:
                current.version +
                1,
            }
          : current;

      if (changed) {

        this.items.update(
          items =>
            items.map(
              item =>
                item.id ===
                buildingId
                  ? next
                  : item,
            ),
        );
      }

      return of({

        building:
          cloneBuilding(
            next,
          ),

        etag:
          buildingEtagForVersion(
            next.version,
          ),
      }).pipe(
        delay(90),
      );

    } catch (error) {

      return throwError(
        () =>
          error,
      );
    }
  }
}

function validateBuildingRegistration(
  resource:
    RegisterBuildingResourceDto,
):
  ApiError
  | undefined {

  const code =
    normalizeCode(
      resource.buildingCode,
    );

  if (
    !/^[A-Z0-9_-]{1,64}$/
      .test(
        code,
      )
  ) {

    return badRequest(
      'INVALID_BUILDING_CODE',

      'Building code must contain 1 to 64 ASCII letters, numbers, hyphens or underscores.',
    );
  }

  return validateBuildingDetails(
    resource,
  );
}

function validateBuildingDetails(
  resource:
    Pick<
      RegisterBuildingResourceDto,
      'name' |
      'description' |
      'address'
    >,
):
  ApiError
  | undefined {

  const name =
    resource.name.trim();

  if (
    !name ||
    name.length > 120
  ) {

    return badRequest(
      'INVALID_BUILDING_NAME',

      'Building name must contain between 1 and 120 characters.',
    );
  }

  if (
    (
      resource.description
        ?.trim()
        .length ??
      0
    ) > 500
  ) {

    return badRequest(
      'INVALID_BUILDING_DESCRIPTION',

      'Building description cannot exceed 500 characters.',
    );
  }

  const {
    streetAddress,
    district,
    city,
    countryCode,
  } = resource.address;

  if (
    !streetAddress.trim() ||
    streetAddress
      .trim()
      .length > 200
  ) {

    return badRequest(
      'INVALID_STREET_ADDRESS',

      'Street address is required and cannot exceed 200 characters.',
    );
  }

  if (
    !district.trim() ||
    district
      .trim()
      .length > 100
  ) {

    return badRequest(
      'INVALID_DISTRICT',

      'District is required and cannot exceed 100 characters.',
    );
  }

  if (
    !city.trim() ||
    city
      .trim()
      .length > 100
  ) {

    return badRequest(
      'INVALID_CITY',

      'City is required and cannot exceed 100 characters.',
    );
  }

  if (
    !/^[A-Za-z]{2}$/
      .test(
        countryCode.trim(),
      )
  ) {

    return badRequest(
      'INVALID_COUNTRY_CODE',

      'Country code must contain exactly two letters.',
    );
  }

  return undefined;
}

function validateZoneDefinition(
  resource:
    Pick<
      AddZoneToBuildingResourceDto,
      'zoneCode' |
      'name' |
      'description' |
      'floorLabel'
    >,
):
  ApiError
  | undefined {

  const code =
    normalizeCode(
      resource.zoneCode,
    );

  if (
    !/^[A-Z0-9_-]{1,64}$/
      .test(
        code,
      )
  ) {

    return badRequest(
      'INVALID_ZONE_CODE',

      'Zone code must contain 1 to 64 ASCII letters, numbers, hyphens or underscores.',
    );
  }

  return validateZoneDetails(
    resource,
  );
}

function validateZoneDetails(
  resource:
    Pick<
      AddZoneToBuildingResourceDto,
      'name' |
      'description' |
      'floorLabel'
    >,
):
  ApiError
  | undefined {

  const name =
    resource.name.trim();

  if (
    !name ||
    name.length > 120
  ) {

    return badRequest(
      'INVALID_ZONE_NAME',

      'Zone name must contain between 1 and 120 characters.',
    );
  }

  if (
    (
      resource.description
        ?.trim()
        .length ??
      0
    ) > 500
  ) {

    return badRequest(
      'INVALID_ZONE_DESCRIPTION',

      'Zone description cannot exceed 500 characters.',
    );
  }

  if (
    (
      resource.floorLabel
        ?.trim()
        .length ??
      0
    ) > 50
  ) {

    return badRequest(
      'INVALID_FLOOR_LABEL',

      'Floor label cannot exceed 50 characters.',
    );
  }

  return undefined;
}

function normalizeAddress(
  address:
    RegisterBuildingResourceDto[
      'address'
    ],
) {

  return {
    streetAddress:
      address.streetAddress
        .trim(),

    district:
      address.district
        .trim(),

    city:
      address.city
        .trim(),

    countryCode:
      address.countryCode
        .trim()
        .toUpperCase(),
  };
}

function normalizeCode(
  value: string,
): string {

  return value
    .trim()
    .toUpperCase();
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

function optionalText(
  value?: string,
):
  string
  | undefined {

  const normalized =
    value?.trim();

  return normalized
    ? normalized
    : undefined;
}

function createLocalId(
  prefix: string,
): string {

  return (
    globalThis.crypto
      ?.randomUUID?.()
    ??
    `${prefix}-${Date.now()}`
  );
}

function cloneZone(
  zone:
    ZoneCatalogRecord,
):
  ZoneCatalogRecord {

  return {
    ...zone,

    createdAt:
      new Date(
        zone.createdAt,
      ),

    updatedAt:
      new Date(
        zone.updatedAt,
      ),
  };
}

function cloneBuilding(
  building:
    BuildingCatalogRecord,
):
  BuildingCatalogRecord {

  return {
    ...building,

    address: {
      ...building.address,
    },

    zones:
      building.zones.map(
        cloneZone,
      ),

    createdAt:
      new Date(
        building.createdAt,
      ),

    updatedAt:
      new Date(
        building.updatedAt,
      ),
  };
}

function toComparable(
  building:
    BuildingCatalogRecord,
): object {

  const {
    updatedAt:
      _updatedAt,

    version:
      _version,

    ...rest
  } = building;

  return rest;
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

function buildingNotFound():
  ApiError {

  return apiError(
    404,

    'BUILDING_NOT_FOUND',

    'The requested building was not found.',
  );
}

function zoneNotFound():
  ApiError {

  return apiError(
    404,

    'ZONE_NOT_FOUND',

    'The requested zone was not found in this building.',
  );
}

function preconditionFailed():
  ApiError {

  return apiError(
    412,

    'PRECONDITION_FAILED',

    'The building changed before the operation could be completed. Reload the latest version.',
  );
}

function preconditionRequired():
  ApiError {

  return apiError(
    428,

    'PRECONDITION_REQUIRED',

    'The operation requires the latest building ETag.',
  );
}