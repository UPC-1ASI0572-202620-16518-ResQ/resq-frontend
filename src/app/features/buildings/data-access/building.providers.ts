import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  BUILDING_GATEWAY,
} from './building.gateway';

import {
  BuildingFacade,
} from './building.facade';

import {
  HttpBuildingGateway,
} from './http-building.gateway';

import {
  MockBuildingGateway,
} from './mock-building.gateway';

export type BuildingDataSource =
  | 'mock'
  | 'http';

export function provideBuildingDataAccess(
  source:
    BuildingDataSource = 'mock',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    BuildingFacade,

    {
      provide:
        BUILDING_GATEWAY,

      useClass:
        source === 'http'
          ? HttpBuildingGateway
          : MockBuildingGateway,
    },
  ]);
}