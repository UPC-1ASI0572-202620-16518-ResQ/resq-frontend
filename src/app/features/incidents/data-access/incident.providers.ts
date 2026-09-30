import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  INCIDENT_GATEWAY,
} from './incident.gateway';

import {
  IncidentFacade,
} from './incident.facade';

import {
  HttpIncidentGateway,
} from './http-incident.gateway';

import {
  MockIncidentGateway,
} from './mock-incident.gateway';

export type IncidentDataSource =
  | 'mock'
  | 'http';

export function provideIncidentDataAccess(
  source:
    IncidentDataSource = 'mock',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    IncidentFacade,

    {
      provide:
        INCIDENT_GATEWAY,

      useClass:
        source === 'http'
          ? HttpIncidentGateway
          : MockIncidentGateway,
    },
  ]);
}