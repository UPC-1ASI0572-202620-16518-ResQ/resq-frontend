import {
  PagedResult,
} from '../../../core/api/pagination';

import {
  Device,
} from '../../../core/models/resq.models';

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
      dto.administrativeStatus,

    capabilities:
      dto.capabilities.map(
        capability => ({

          id:
            capability.id,

          code:
            capability.code,

          kind:
            capability.kind,

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

export function mapMockDeviceToCatalog(
  device: Device,
): DeviceCatalogRecord {

  return {
    externalReference: device.externalReferenceDetails,
    id:
      device.id,

    organizationId:
      device.organizationId,

    deviceCode:
      device.deviceCode,

    name:
      device.name,

    description:
      device.description ||
      undefined,

    specifications: {

      manufacturer:
        optionalText(
          device.specifications
            .manufacturer,
        ),

      model:
        optionalText(
          device.specifications
            .model,
        ),

      serialNumber:
        optionalText(
          device.specifications
            .serialNumber,
        ),
    },

    assignment: {

      buildingId:
        device.assignment
          .buildingId,

      zoneId:
        device.assignment
          .zoneId ||
        undefined,
    },

    administrativeStatus:
      device.administrativeStatus,

    capabilities:
      device.capabilities.map(
        mapMockCapability,
      ),

    createdAt:
      new Date(
        device.createdAt,
      ),

    updatedAt:
      new Date(
        device.updatedAt,
      ),

    version:
      device.version,
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

export function versionFromEtag(
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

function mapMockCapability(
  capability:
    Device['capabilities'][number],
):
  DeviceCatalogCapability {

  return {
    category: capability.category,
    state: capability.state,
    id:
      capability.id,

    code:
      capability.code,

    kind:
      capability.kind,

    unit:
      capability.unit,
  };
}

function optionalText(
  value:
    string
    | undefined,
):
  string
  | undefined {

  const normalized =
    value?.trim();

  return normalized
    ? normalized
    : undefined;
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
