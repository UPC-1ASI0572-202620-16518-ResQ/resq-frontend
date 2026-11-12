export type LocationAdministrativeStatusDto =
  | 'ACTIVE'
  | 'INACTIVE';

export interface BuildingAddressResourceDto {
  streetAddress: string;
  district: string;
  city: string;
  countryCode: string;
}

export interface ZoneResourceDto {
  id: string;
  buildingId: string;
  zoneCode: string;
  name: string;

  description?:
    string
    | null;

  floorLabel?:
    string
    | null;

  administrativeStatus:
    LocationAdministrativeStatusDto;

  availableForAssignment:
    boolean;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface FloorResourceDto {
  id: string;
  buildingId: string;
  label: string;
  level: number;
  createdAt: string;
  updatedAt: string;
}

export interface BuildingResourceDto {
  id: string;

  organizationId: string;

  buildingCode: string;

  name: string;

  description?:
    string
    | null;

  address:
    BuildingAddressResourceDto;

  administrativeStatus:
    LocationAdministrativeStatusDto;

  zones:
    ZoneResourceDto[];

  floors:
    FloorResourceDto[];

  createdAt:
    string;

  updatedAt:
    string;

  version:
    number;
}

export interface BuildingPageResourceDto {
  items:
    BuildingResourceDto[];

  page:
    number;

  size:
    number;

  totalElements:
    number;

  totalPages:
    number;
}

export interface ZonePageResourceDto {
  items:
    ZoneResourceDto[];

  page:
    number;

  size:
    number;

  totalElements:
    number;

  totalPages:
    number;
}

export interface RegisterBuildingResourceDto {
  buildingCode: string;

  name: string;

  description?:
    string;

  address:
    BuildingAddressResourceDto;

  floors: SaveFloorResourceDto[];
}

export interface SaveFloorResourceDto {
  label: string;
  level: number;
}

export interface UpdateBuildingDetailsResourceDto {
  name: string;

  description?:
    string;

  address:
    BuildingAddressResourceDto;
}

export interface ChangeBuildingAdministrativeStatusResourceDto {
  administrativeStatus:
    LocationAdministrativeStatusDto;
}

export interface AddZoneToBuildingResourceDto {
  zoneCode: string;

  name: string;

  description?:
    string;

  floorLabel?:
    string;
}

export interface UpdateZoneResourceDto {
  name: string;

  description?:
    string;

  floorLabel?:
    string;
}

export interface ChangeZoneAdministrativeStatusResourceDto {
  administrativeStatus:
    LocationAdministrativeStatusDto;
}
