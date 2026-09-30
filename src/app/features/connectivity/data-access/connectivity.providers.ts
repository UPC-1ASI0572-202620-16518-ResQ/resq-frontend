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

import {
  MockConnectivityGateway,
} from './mock-connectivity.gateway';

export type ConnectivityDataSource =
  'mock'
  | 'http';

export function provideConnectivityDataAccess(
  source:
    ConnectivityDataSource = 'mock',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    ConnectivityFacade,

    {
      provide:
        CONNECTIVITY_GATEWAY,

      useClass:
        source === 'http'
          ? HttpConnectivityGateway
          : MockConnectivityGateway,
    },
  ]);
}