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

export type BuildingDataSource = 'http';

export function provideBuildingDataAccess(
  source:
    BuildingDataSource = 'http',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    BuildingFacade,

    {
      provide:
        BUILDING_GATEWAY,

      useClass: HttpBuildingGateway,
    },
  ]);
}
