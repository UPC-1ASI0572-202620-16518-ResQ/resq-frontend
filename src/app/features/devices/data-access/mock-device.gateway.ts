import {
  Injectable,
  inject,
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
  paginateInMemory,
  PagedResult,
  PageRequest,
} from '../../../core/api/pagination';

import {
  DEVICES,
} from '../../../core/mock-data/resq.mock';

import {
  DeviceAdministrativeStatus,
} from '../../../core/models/resq.models';

import {
  AssignDeviceToLocationResourceDto,
  ChangeDeviceAdministrativeStatusResourceDto,
  RegisterDeviceResourceDto,
  ReplaceDeviceCapabilitiesResourceDto,
  UpdateDeviceDetailsResourceDto,
} from './device.dto';

import {
  DeviceCatalogCapability,
  DeviceCatalogRecord,
  DeviceGateway,
  DeviceQueryFilters,
  ExternalDeviceReferenceQuery,
  VersionedDeviceCatalogRecord,
} from './device.gateway';

import {
  etagForVersion,
  mapMockDeviceToCatalog,
  versionFromEtag,
  withEtag,
} from './device.mapper';
import { BuildingStoreService } from '../../../core/services/building-store.service';

@Injectable()
export class MockDeviceGateway
  implements DeviceGateway {

  private readonly buildingStore = inject(BuildingStoreService);

  private readonly items =
    signal<DeviceCatalogRecord[]>(
      DEVICES.map(
        mapMockDeviceToCatalog,
      ),
    );

  getDevices(
    filters:
      DeviceQueryFilters,

    page:
      PageRequest,
  ):
    Observable<
      PagedResult<DeviceCatalogRecord>
    > {

    const normalizedPage =
      normalizePage(
        page,
      );

    const filtered =
      this.catalogItems()
        .filter(
          device =>
            !filters.buildingId ||
            device.assignment
              .buildingId ===
              filters.buildingId,
        )
        .filter(
          device =>
            !filters.zoneId ||
            device.assignment
              .zoneId ===
              filters.zoneId,
        )
        .filter(
          device =>
            !filters
              .administrativeStatus ||
            device
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
        filtered,
        normalizedPage,
      ),
    ).pipe(
      delay(80),
    );
  }

  getDeviceById(
    deviceId: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
      | undefined
    > {

    const device =
      this.catalogItems().find(
        item =>
          item.id ===
          deviceId,
      );

    return of(
      device
        ? withEtag(
            cloneDevice(
              device,
            ),
          )
        : undefined,
    ).pipe(
      delay(60),
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

    const sourceSystem =
      reference.sourceSystem
        .trim()
        .toLowerCase();

    const externalDeviceId =
      reference.externalDeviceId
        .trim();

    const device =
      this.items().find(
        item =>
          item.externalReference
            ?.sourceSystem
            .toLowerCase() ===
            sourceSystem &&
          item.externalReference
            .externalDeviceId ===
            externalDeviceId,
      );

    return of(
      device
        ? withEtag(
            cloneDevice(
              device,
            ),
          )
        : undefined,
    ).pipe(
      delay(60),
    );
  }

  registerDevice(
    resource:
      RegisterDeviceResourceDto,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    const validationError =
      validateRegistration(
        resource,
      );

    if (
      validationError
    ) {
      return throwError(
        () =>
          validationError,
      );
    }

    const deviceCode =
      normalizeDeviceCode(
        resource.deviceCode,
      );

    if (
      this.items().some(
        item =>
          item.deviceCode ===
          deviceCode,
      )
    ) {
      return throwError(
        () =>
          conflict(
            'DEVICE_CODE_ALREADY_EXISTS',
            'Device code is already registered.',
          ),
      );
    }

    if (
      resource.externalReference &&
      this.items().some(
        item =>
          item.externalReference
            ?.sourceSystem
            .toLowerCase() ===
            resource
              .externalReference!
              .sourceSystem
              .trim()
              .toLowerCase() &&
          item.externalReference
            .externalDeviceId ===
            resource
              .externalReference!
              .externalDeviceId
              .trim(),
      )
    ) {

      return throwError(
        () =>
          conflict(
            'EXTERNAL_REFERENCE_ALREADY_EXISTS',
            'The external device reference is already registered.',
          ),
      );
    }

    const now =
      new Date();

    const id =
      createLocalId();

    const device:
      DeviceCatalogRecord = {

      id,

      organizationId:
        'securitybear',

      deviceCode,

      name:
        resource.name.trim(),

      description:
        optionalText(
          resource.description,
        ),

      specifications: {

        manufacturer:
          optionalText(
            resource
              .specifications
              .manufacturer ??
            undefined,
          ),

        model:
          optionalText(
            resource
              .specifications
              .model ??
            undefined,
          ),

        serialNumber:
          optionalText(
            resource
              .specifications
              .serialNumber ??
            undefined,
          ),
      },

      assignment: {

        buildingId:
          resource.assignment
            .buildingId,

        zoneId:
          optionalText(
            resource.assignment
              .zoneId ??
            undefined,
          ),
      },

      externalReference:
        resource.externalReference
          ? {
              sourceSystem:
                resource
                  .externalReference
                  .sourceSystem
                  .trim()
                  .toLowerCase(),

              externalDeviceId:
                resource
                  .externalReference
                  .externalDeviceId
                  .trim(),
            }
          : undefined,

      administrativeStatus:
        'INACTIVE',

      capabilities:
        resource.capabilities.map(
          (
            capability,
            index,
          ) => ({

            id:
              `${id}-cap-${index + 1}`,

            code:
              capability.code.trim(),

            kind:
              capability.kind,

            unit:
              capability.kind ===
              'MEASUREMENT'
                ? optionalText(
                    capability.unit ??
                    undefined,
                  )
                : undefined,
          }),
        ),

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
        device,
      ],
    );

    return of(
      withEtag(
        cloneDevice(
          device,
        ),
      ),
    ).pipe(
      delay(100),
    );
  }

  private catalogItems(): DeviceCatalogRecord[] {
    const current = new Map(this.items().map(item => [item.id, item]));
    for (const device of this.buildingStore.devices()) {
      if (!current.has(device.id)) current.set(device.id, mapMockDeviceToCatalog(device));
    }
    return [...current.values()];
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

    return this.update(
      deviceId,
      etag,

      device => {

        ensureEditable(
          device,
        );

        const name =
          resource.name.trim();

        if (
          !name ||
          name.length > 120
        ) {
          throw badRequest(
            'INVALID_DEVICE_NAME',
            'Device name must contain between 1 and 120 characters.',
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
          throw badRequest(
            'INVALID_DEVICE_DESCRIPTION',
            'Device description cannot exceed 500 characters.',
          );
        }

        return {
          ...device,

          name,

          description:
            optionalText(
              resource.description,
            ),

          specifications: {

            manufacturer:
              optionalText(
                resource
                  .specifications
                  .manufacturer ??
                undefined,
              ),

            model:
              optionalText(
                resource
                  .specifications
                  .model ??
                undefined,
              ),

            serialNumber:
              optionalText(
                resource
                  .specifications
                  .serialNumber ??
                undefined,
              ),
          },
        };
      },
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

    return this.update(
      deviceId,
      etag,

      device => {

        ensureEditable(
          device,
        );

        ensureInactive(
          device,

          'Capabilities can only be changed while the device is INACTIVE.',
        );

        const error =
          validateCapabilities(
            resource.capabilities,
          );

        if (error) {
          throw error;
        }

        const existingByCode =
          new Map(
            device.capabilities.map(
              capability => [
                capability.code,
                capability,
              ],
            ),
          );

        const capabilities =
          resource.capabilities.map(
            (
              capability,
              index,
            ):
              DeviceCatalogCapability => ({

              id:
                existingByCode.get(
                  capability.code.trim(),
                )?.id ??
                `${device.id}-cap-${device.version + 1}-${index + 1}`,

              code:
                capability.code.trim(),

              kind:
                capability.kind,

              unit:
                capability.kind ===
                'MEASUREMENT'
                  ? optionalText(
                      capability.unit ??
                      undefined,
                    )
                  : undefined,
            }),
          );

        return {
          ...device,
          capabilities,
        };
      },
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

    return this.update(
      deviceId,
      etag,

      device => {

        ensureEditable(
          device,
        );

        ensureInactive(
          device,

          'Device assignment can only be changed while the device is INACTIVE.',
        );

        if (
          !resource
            .buildingId
            .trim()
        ) {

          throw badRequest(
            'BUILDING_REQUIRED',
            'A building is required.',
          );
        }

        return {
          ...device,

          assignment: {

            buildingId:
              resource
                .buildingId,

            zoneId:
              optionalText(
                resource.zoneId,
              ),
          },
        };
      },
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

    return this.update(
      deviceId,
      etag,

      device => {

        ensureTransition(
          device.administrativeStatus,
          resource
            .administrativeStatus,
        );

        return {
          ...device,

          administrativeStatus:
            resource
              .administrativeStatus,
        };
      },
    );
  }

  private update(
    deviceId: string,

    etag: string,

    transform:
      (
        device:
          DeviceCatalogRecord,
      ) =>
        DeviceCatalogRecord,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    const current =
      this.items().find(
        item =>
          item.id ===
          deviceId,
      );

    if (
      !current
    ) {
      return throwError(
        () =>
          notFound(),
      );
    }

    const expectedVersion =
      versionFromEtag(
        etag,
      );

    if (
      !expectedVersion
    ) {
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
          cloneDevice(
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

      if (
        changed
      ) {

        this.items.update(
          items =>
            items.map(
              item =>
                item.id ===
                deviceId
                  ? next
                  : item,
            ),
        );
      }

      return of({
        device:
          cloneDevice(
            next,
          ),

        etag:
          etagForVersion(
            next.version,
          ),
      }).pipe(
        delay(90),
      );

    } catch (
      error
    ) {

      return throwError(
        () =>
          error,
      );
    }
  }
}

function validateRegistration(
  resource:
    RegisterDeviceResourceDto,
):
  ApiError
  | undefined {

  const deviceCode =
    normalizeDeviceCode(
      resource.deviceCode,
    );

  if (
    !/^[A-Z0-9_-]{1,64}$/
      .test(
        deviceCode,
      )
  ) {

    return badRequest(
      'INVALID_DEVICE_CODE',

      'Device code must contain 1 to 64 ASCII letters, numbers, hyphens or underscores.',
    );
  }

  if (
    !resource.name.trim() ||
    resource.name.trim().length >
    120
  ) {

    return badRequest(
      'INVALID_DEVICE_NAME',

      'Device name must contain between 1 and 120 characters.',
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
      'INVALID_DEVICE_DESCRIPTION',

      'Device description cannot exceed 500 characters.',
    );
  }

  if (
    !resource.assignment
      .buildingId
      .trim()
  ) {

    return badRequest(
      'BUILDING_REQUIRED',

      'A building is required.',
    );
  }

  return validateCapabilities(
    resource.capabilities,
  );
}

function validateCapabilities(
  capabilities:
    RegisterDeviceResourceDto[
      'capabilities'
    ],
):
  ApiError
  | undefined {

  if (
    !capabilities.length
  ) {

    return badRequest(
      'CAPABILITY_REQUIRED',

      'At least one capability is required.',
    );
  }

  const codes =
    new Set<string>();

  for (
    const capability
    of capabilities
  ) {

    const code =
      capability.code.trim();

    if (
      !code ||
      code.length > 80
    ) {

      return badRequest(
        'INVALID_CAPABILITY_CODE',

        'Capability codes must contain between 1 and 80 characters.',
      );
    }

    if (
      codes.has(
        code,
      )
    ) {

      return badRequest(
        'DUPLICATE_CAPABILITY_CODE',

        'Capability codes must be unique within a device.',
      );
    }

    if (
      (
        capability.unit
          ?.trim()
          .length ??
        0
      ) > 30
    ) {

      return badRequest(
        'INVALID_CAPABILITY_UNIT',

        'Capability units cannot exceed 30 characters.',
      );
    }

    codes.add(
      code,
    );
  }

  return undefined;
}

function ensureEditable(
  device:
    DeviceCatalogRecord,
): void {

  if (
    device
      .administrativeStatus ===
    'RETIRED'
  ) {

    throw conflict(
      'DEVICE_RETIRED',

      'A retired device is read-only.',
    );
  }
}

function ensureInactive(
  device:
    DeviceCatalogRecord,

  message:
    string,
): void {

  if (
    device
      .administrativeStatus !==
    'INACTIVE'
  ) {

    throw conflict(
      'DEVICE_MUST_BE_INACTIVE',
      message,
    );
  }
}

function ensureTransition(
  current:
    DeviceAdministrativeStatus,

  target:
    DeviceAdministrativeStatus,
): void {

  if (
    current === target
  ) {
    return;
  }

  const valid =
    (
      current ===
      'INACTIVE' &&
      target ===
      'ACTIVE'
    ) ||
    (
      current ===
      'ACTIVE' &&
      target ===
      'INACTIVE'
    ) ||
    (
      current ===
      'INACTIVE' &&
      target ===
      'RETIRED'
    );

  if (
    !valid
  ) {

    throw conflict(
      'INVALID_DEVICE_STATUS_TRANSITION',

      `Administrative status cannot change from ${current} to ${target}.`,
    );
  }
}

function normalizeDeviceCode(
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

function createLocalId():
  string {

  return (
    globalThis.crypto
      ?.randomUUID?.()
    ??
    `local-device-${Date.now()}`
  );
}

function cloneDevice(
  device:
    DeviceCatalogRecord,
):
  DeviceCatalogRecord {

  return {
    ...device,

    specifications: {
      ...device.specifications,
    },

    assignment: {
      ...device.assignment,
    },

    externalReference:
      device.externalReference
        ? {
            ...device
              .externalReference,
          }
        : undefined,

    capabilities:
      device.capabilities.map(
        capability => ({
          ...capability,
        }),
      ),

    createdAt:
      new Date(
        device.createdAt,
      ),

    updatedAt:
      new Date(
        device.updatedAt,
      ),
  };
}

function toComparable(
  device:
    DeviceCatalogRecord,
): object {

  const {
    updatedAt:
      _updatedAt,

    version:
      _version,

    ...rest
  } = device;

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

function notFound():
  ApiError {

  return apiError(
    404,

    'DEVICE_NOT_FOUND',

    'The requested device was not found.',
  );
}

function preconditionFailed():
  ApiError {

  return apiError(
    412,

    'PRECONDITION_FAILED',

    'The device changed before the operation could be completed. Reload the latest version.',
  );
}

function preconditionRequired():
  ApiError {

  return apiError(
    428,

    'PRECONDITION_REQUIRED',

    'The operation requires the latest device ETag.',
  );
}
