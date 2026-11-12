import {
  PagedResult,
} from '../../../core/api/pagination';

import {
  DevicePageResourceDto,
  DeviceResourceDto,
} from './device.dto';

import {
  DeviceCatalogCapability,
  DeviceCatalogRecord,
  VersionedDeviceCatalogRecord,
} from './device.gateway';

export function mapDeviceResourceDto(
  dto: DeviceResourceDto,
): DeviceCatalogRecord {

  return {
    id:
      dto.id,

    organizationId:
      dto.organizationId,

    deviceCode:
      dto.deviceCode,

    name:
      dto.name,

    description:
      dto.description ??
      undefined,

    specifications: {

      manufacturer:
        dto.specifications
          .manufacturer ??
        undefined,

      model:
        dto.specifications
          .model ??
        undefined,

      serialNumber:
        dto.specifications
          .serialNumber ??
        undefined,
    },

    assignment: {

      buildingId:
        dto.assignment
          .buildingId,

      zoneId:
        dto.assignment
          .zoneId ??
        undefined,
    },

    externalReference:
      dto.externalReference
        ? {
            sourceSystem:
              dto.externalReference
                .sourceSystem,

            externalDeviceId:
              dto.externalReference
                .externalDeviceId,
          }
        : undefined,

    administrativeStatus:
      normalizeCode(dto.administrativeStatus) as DeviceCatalogRecord['administrativeStatus'],

    capabilities:
      dto.capabilities.map(
        capability => ({

          id:
            capability.id,

          code:
            capability.code,

          kind:
            normalizeCode(capability.kind) as DeviceCatalogCapability['kind'],

          unit:
            capability.unit ??
            undefined,
        }),
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

export function mapDevicePageResourceDto(
  dto:
    DevicePageResourceDto,
):
  PagedResult<DeviceCatalogRecord> {

  return {
    items:
      dto.items.map(
        mapDeviceResourceDto,
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

export function withEtag(
  device:
    DeviceCatalogRecord,

  etag?:
    string
    | null,
):
  VersionedDeviceCatalogRecord {

  return {
    device,

    etag:
      normalizeEtag(
        etag,
      ) ??
      etagForVersion(
        device.version,
      ),
  };
}

export function etagForVersion(
  version: number,
): string {

  return `"${version}"`;
}

function normalizeEtag(
  value?:
    string
    | null,
):
  string
  | undefined {

  const normalized =
    value?.trim();

  return normalized
    ? normalized
    : undefined;
}

function normalizeCode(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}
