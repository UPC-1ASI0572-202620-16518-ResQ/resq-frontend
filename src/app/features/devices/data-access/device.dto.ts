import {
  CapabilityKind,
  DeviceAdministrativeStatus,
} from '../../../core/models/resq.models';

export interface DeviceSpecificationsResourceDto {
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
}

export interface DeviceAssignmentResourceDto {
  buildingId: string;
  zoneId?: string | null;
}

export interface ExternalDeviceReferenceResourceDto {
  sourceSystem: string;
  externalDeviceId: string;
}

export interface CapabilityDefinitionResourceDto {
  code: string;
  kind: CapabilityKind;
  unit?: string | null;
}

export interface DeviceCapabilityResourceDto {
  id: string;
  code: string;
  kind: CapabilityKind;
  unit?: string | null;
}

export interface DeviceResourceDto {
  id: string;

  organizationId: string;

  deviceCode: string;

  name: string;

  description?: string | null;

  specifications:
    DeviceSpecificationsResourceDto;

  assignment:
    DeviceAssignmentResourceDto;

  externalReference?:
    ExternalDeviceReferenceResourceDto
    | null;

  administrativeStatus:
    DeviceAdministrativeStatus;

  capabilities:
    DeviceCapabilityResourceDto[];

  createdAt: string;

  updatedAt: string;

  version: number;
}

export interface DevicePageResourceDto {
  items: DeviceResourceDto[];

  page: number;

  size: number;

  totalElements: number;

  totalPages: number;
}

export interface RegisterDeviceResourceDto {
  deviceCode: string;

  name: string;

  description?: string;

  specifications:
    DeviceSpecificationsResourceDto;

  assignment:
    DeviceAssignmentResourceDto;

  externalReference?:
    ExternalDeviceReferenceResourceDto;

  capabilities:
    CapabilityDefinitionResourceDto[];
}

export interface UpdateDeviceDetailsResourceDto {
  name: string;

  description?: string;

  specifications:
    DeviceSpecificationsResourceDto;
}

export interface ReplaceDeviceCapabilitiesResourceDto {
  capabilities:
    CapabilityDefinitionResourceDto[];
}

export interface AssignDeviceToLocationResourceDto {
  buildingId: string;

  zoneId?: string;
}

export interface ChangeDeviceAdministrativeStatusResourceDto {
  administrativeStatus:
    DeviceAdministrativeStatus;
}