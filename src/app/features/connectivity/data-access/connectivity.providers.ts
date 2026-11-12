import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  CONNECTIVITY_GATEWAY,
} from './connectivity.gateway';

import {
  ConnectivityFacade,
} from './connectivity.facade';

import {
  HttpConnectivityGateway,
} from './http-connectivity.gateway';

export type ConnectivityDataSource = 'http';

export function provideConnectivityDataAccess(
  source:
    ConnectivityDataSource = 'http',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    ConnectivityFacade,

    {
      provide:
        CONNECTIVITY_GATEWAY,

      useClass: HttpConnectivityGateway,
    },
  ]);
}
