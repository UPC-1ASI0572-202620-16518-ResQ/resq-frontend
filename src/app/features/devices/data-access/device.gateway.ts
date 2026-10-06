import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

import {
  PagedResult,
  PageRequest,
} from '../../../core/api/pagination';

import {
  CapabilityKind,
  DeviceAdministrativeStatus,
  DeviceCapabilityCategory,
  ActuatorState,
} from '../../../core/models/resq.models';

import {
  AssignDeviceToLocationResourceDto,
  ChangeDeviceAdministrativeStatusResourceDto,
  RegisterDeviceResourceDto,
  ReplaceDeviceCapabilitiesResourceDto,
  UpdateDeviceDetailsResourceDto,
} from './device.dto';

export interface DeviceCatalogSpecifications {
  manufacturer?: string;

  model?: string;

  serialNumber?: string;
}

export interface DeviceCatalogAssignment {
  buildingId: string;

  zoneId?: string;
}

export interface ExternalDeviceReference {
  sourceSystem: string;

  externalDeviceId: string;
}

export interface DeviceCatalogCapability {
  id: string;

  code: string;

  kind: CapabilityKind;

  unit?: string;
  category?: DeviceCapabilityCategory;
  state?: ActuatorState;
}

export interface DeviceCatalogRecord {
  id: string;

  organizationId: string;

  deviceCode: string;

  name: string;

  description?: string;

  specifications:
    DeviceCatalogSpecifications;

  assignment:
    DeviceCatalogAssignment;

  externalReference?:
    ExternalDeviceReference;

  administrativeStatus:
    DeviceAdministrativeStatus;

  capabilities:
    DeviceCatalogCapability[];

  createdAt: Date;

  updatedAt: Date;

  version: number;
}

export interface VersionedDeviceCatalogRecord {
  device:
    DeviceCatalogRecord;

  etag?: string;
}

export interface DeviceQueryFilters {
  buildingId?: string;

  zoneId?: string;

  administrativeStatus?:
    DeviceAdministrativeStatus;
}

export interface ExternalDeviceReferenceQuery {
  sourceSystem: string;

  externalDeviceId: string;
}

export interface DeviceGateway {

  getDevices(
    filters:
      DeviceQueryFilters,

    page:
      PageRequest,
  ):
    Observable<
      PagedResult<DeviceCatalogRecord>
    >;

  getDeviceById(
    deviceId: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
      | undefined
    >;

  getDeviceByExternalReference(
    reference:
      ExternalDeviceReferenceQuery,
  ):
    Observable<
      VersionedDeviceCatalogRecord
      | undefined
    >;

  registerDevice(
    resource:
      RegisterDeviceResourceDto,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    >;

  updateDeviceDetails(
    deviceId: string,

    resource:
      UpdateDeviceDetailsResourceDto,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    >;

  replaceDeviceCapabilities(
    deviceId: string,

    resource:
      ReplaceDeviceCapabilitiesResourceDto,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    >;

  assignDeviceToLocation(
    deviceId: string,

    resource:
      AssignDeviceToLocationResourceDto,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    >;

  changeDeviceAdministrativeStatus(
    deviceId: string,

    resource:
      ChangeDeviceAdministrativeStatusResourceDto,

    etag: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    >;
}

export const DEVICE_GATEWAY =
  new InjectionToken<DeviceGateway>(
    'DEVICE_GATEWAY',
  );
