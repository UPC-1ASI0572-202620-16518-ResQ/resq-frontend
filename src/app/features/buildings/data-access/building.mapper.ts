import {
  PagedResult,
} from '../../../core/api/pagination';

import {
  BuildingPageResourceDto,
  BuildingResourceDto,
  FloorResourceDto,
  ZonePageResourceDto,
  ZoneResourceDto,
} from './building.dto';

import {
  BuildingCatalogRecord,
  FloorCatalogRecord,
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
      streetAddress: dto.address.streetAddress ?? '',
      district: dto.address.district ?? '',
      city: dto.address.city ?? '',
      countryCode: dto.address.countryCode ?? '',
    },

    administrativeStatus:
      normalizeLocationStatus(dto.administrativeStatus),

    zones:
      dto.zones.map(
        mapZoneResourceDto,
      ),

    floors:
      (dto.floors ?? []).map(mapFloorResourceDto),

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

export function mapFloorResourceDto(dto: FloorResourceDto): FloorCatalogRecord {
  return {
    id: dto.id,
    buildingId: dto.buildingId,
    label: dto.label,
    level: dto.level,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
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
      normalizeLocationStatus(dto.administrativeStatus),

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

function normalizeLocationStatus(value: string): 'ACTIVE' | 'INACTIVE' {
  return value.trim().toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
}
