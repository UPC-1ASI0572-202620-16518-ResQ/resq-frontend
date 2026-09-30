import {
  PagedResult,
} from '../../../core/api/pagination';

import {
  Building,
} from '../../../core/models/resq.models';

import {
  BuildingPageResourceDto,
  BuildingResourceDto,
  ZonePageResourceDto,
  ZoneResourceDto,
} from './building.dto';

import {
  BuildingCatalogRecord,
  VersionedBuildingCatalogRecord,
  ZoneCatalogRecord,
} from './building.gateway';

export function mapBuildingResourceDto(
  dto:
    BuildingResourceDto,
):
  BuildingCatalogRecord {

  return {
    id:
      dto.id,

    organizationId:
      dto.organizationId,

    buildingCode:
      dto.buildingCode,

    name:
      dto.name,

    description:
      dto.description ??
      undefined,

    address: {
      ...dto.address,
    },

    administrativeStatus:
      dto.administrativeStatus,

    zones:
      dto.zones.map(
        mapZoneResourceDto,
      ),

    createdAt:
      new Date(
        dto.createdAt,
      ),

    updatedAt:
      new Date(
        dto.updatedAt,
      ),

    version:
      dto.version,
  };
}

export function mapZoneResourceDto(
  dto:
    ZoneResourceDto,
):
  ZoneCatalogRecord {

  return {
    id:
      dto.id,

    buildingId:
      dto.buildingId,

    zoneCode:
      dto.zoneCode,

    name:
      dto.name,

    description:
      dto.description ??
      undefined,

    floorLabel:
      dto.floorLabel ??
      undefined,

    administrativeStatus:
      dto.administrativeStatus,

    availableForAssignment:
      dto.availableForAssignment,

    createdAt:
      new Date(
        dto.createdAt,
      ),

    updatedAt:
      new Date(
        dto.updatedAt,
      ),
  };
}

export function mapBuildingPageResourceDto(
  dto:
    BuildingPageResourceDto,
):
  PagedResult<
    BuildingCatalogRecord
  > {

  return {
    items:
      dto.items.map(
        mapBuildingResourceDto,
      ),

    page:
      dto.page,

    size:
      dto.size,

    totalElements:
      dto.totalElements,

    totalPages:
      dto.totalPages,
  };
}

export function mapZonePageResourceDto(
  dto:
    ZonePageResourceDto,
):
  PagedResult<
    ZoneCatalogRecord
  > {

  return {
    items:
      dto.items.map(
        mapZoneResourceDto,
      ),

    page:
      dto.page,

    size:
      dto.size,

    totalElements:
      dto.totalElements,

    totalPages:
      dto.totalPages,
  };
}

/**
 * Temporary compatibility mapper for the current frontend mock.
 *
 * The legacy mock models:
 *
 * Building -> Floor -> Space
 *
 * while the Building Management bounded context models:
 *
 * Building -> Zone
 *
 * with floorLabel as descriptive information.
 *
 * This conversion exists only so MockBuildingGateway can expose
 * the same contract that the future backend adapter will expose.
 */
export function mapLegacyBuildingToCatalog(
  building:
    Building,
):
  BuildingCatalogRecord {

  const legacyDate =
    new Date(
      0,
    );

  const zones:
    ZoneCatalogRecord[] =
    building.floors.flatMap(
      floor =>
        floor.spaces.map(
          space => ({

            id:
              space.id,

            buildingId:
              building.id,

            zoneCode:
              legacyZoneCode(
                space.id,
                space.roomNumber,
              ),

            name:
              space.name,

            floorLabel:
              floor.name,

            administrativeStatus:
              'ACTIVE',

            availableForAssignment:
              true,

            createdAt:
              new Date(
                legacyDate,
              ),

            updatedAt:
              new Date(
                legacyDate,
              ),
          }),
        ),
    );

  return {
    id:
      building.id,

    /*
     * Temporary organization identifier used only
     * by the current mock adapter.
     *
     * This value must later come from IAM /
     * authenticated organization context.
     */
    organizationId:
      'securitybear',

    buildingCode:
      normalizeCode(
        building.id,
      ),

    name:
      building.name,

    description:
      building.description,

    /*
     * The current legacy Building model stores the
     * address as one string.
     *
     * We intentionally DO NOT invent district,
     * city or country data.
     */
    address: {

      streetAddress:
        building.address,

      district:
        '',

      city:
        '',

      countryCode:
        '',
    },

    administrativeStatus:
      'ACTIVE',

    zones,

    createdAt:
      new Date(
        legacyDate,
      ),

    updatedAt:
      new Date(
        legacyDate,
      ),

    version:
      1,
  };
}

export function withBuildingEtag(
  building:
    BuildingCatalogRecord,

  etag?:
    string
    | null,
):
  VersionedBuildingCatalogRecord {

  return {
    building,

    etag:
      normalizeText(
        etag ??
        undefined,
      ) ??
      buildingEtagForVersion(
        building.version,
      ),
  };
}

export function buildingEtagForVersion(
  version: number,
): string {

  return `"${version}"`;
}

export function buildingVersionFromEtag(
  etag: string,
):
  number
  | undefined {

  const normalized =
    etag
      .trim()
      .replace(
        /^W\//i,
        '',
      )
      .replace(
        /^"|"$/g,
        '',
      );

  const version =
    Number(
      normalized,
    );

  return (
    Number.isInteger(
      version,
    ) &&
    version > 0
  )
    ? version
    : undefined;
}

function legacyZoneCode(
  spaceId: string,

  roomNumber?: string,
): string {

  return normalizeCode(
    roomNumber ||
    spaceId,
  );
}

function normalizeCode(
  value: string,
): string {

  const normalized =
    value
      .trim()
      .toUpperCase()
      .replace(
        /[^A-Z0-9_-]+/g,
        '_',
      );

  return (
    normalized.slice(
      0,
      64,
    ) ||
    'LOCATION'
  );
}

function normalizeText(
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