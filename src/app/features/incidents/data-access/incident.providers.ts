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

export type IncidentDataSource = 'http';

export function provideIncidentDataAccess(
  source:
    IncidentDataSource = 'http',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    IncidentFacade,

    {
      provide:
        INCIDENT_GATEWAY,

      useClass: HttpIncidentGateway,
    },
  ]);
}
