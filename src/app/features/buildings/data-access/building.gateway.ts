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
  AddZoneToBuildingResourceDto,
  ChangeBuildingAdministrativeStatusResourceDto,
  ChangeZoneAdministrativeStatusResourceDto,
  RegisterBuildingResourceDto,
  UpdateBuildingDetailsResourceDto,
  UpdateZoneResourceDto,
} from './building.dto';

export type LocationAdministrativeStatus =
  | 'ACTIVE'
  | 'INACTIVE';

export interface BuildingAddress {
  streetAddress: string;

  district: string;

  city: string;

  countryCode: string;
}

export interface ZoneCatalogRecord {
  id: string;

  buildingId: string;

  zoneCode: string;

  name: string;

  description?: string;

  floorLabel?: string;

  administrativeStatus:
    LocationAdministrativeStatus;

  availableForAssignment:
    boolean;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export interface BuildingCatalogRecord {
  id: string;

  organizationId: string;

  buildingCode: string;

  name: string;

  description?: string;

  address:
    BuildingAddress;

  administrativeStatus:
    LocationAdministrativeStatus;

  zones:
    ZoneCatalogRecord[];

  createdAt:
    Date;

  updatedAt:
    Date;

  version:
    number;
}

export interface VersionedBuildingCatalogRecord {
  building:
    BuildingCatalogRecord;

  etag?: string;
}

export interface BuildingQueryFilters {
  administrativeStatus?:
    LocationAdministrativeStatus;
}

export interface ZoneQueryFilters {
  administrativeStatus?:
    LocationAdministrativeStatus;
}

export interface BuildingGateway {

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
    >;

  getBuildingById(
    buildingId: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
      | undefined
    >;

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
    >;

  getZoneById(
    buildingId: string,

    zoneId: string,
  ):
    Observable<
      ZoneCatalogRecord
      | undefined
    >;

  registerBuilding(
    resource:
      RegisterBuildingResourceDto,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    >;

  updateBuildingDetails(
    buildingId: string,

    resource:
      UpdateBuildingDetailsResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    >;

  changeBuildingAdministrativeStatus(
    buildingId: string,

    resource:
      ChangeBuildingAdministrativeStatusResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    >;

  addZoneToBuilding(
    buildingId: string,

    resource:
      AddZoneToBuildingResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    >;

  updateZone(
    buildingId: string,

    zoneId: string,

    resource:
      UpdateZoneResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    >;

  changeZoneAdministrativeStatus(
    buildingId: string,

    zoneId: string,

    resource:
      ChangeZoneAdministrativeStatusResourceDto,

    etag: string,
  ):
    Observable<
      VersionedBuildingCatalogRecord
    >;
}

export const BUILDING_GATEWAY =
  new InjectionToken<BuildingGateway>(
    'BUILDING_GATEWAY',
  );