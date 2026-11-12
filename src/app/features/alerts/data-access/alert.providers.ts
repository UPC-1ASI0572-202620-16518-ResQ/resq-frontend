import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  ALERT_RESPONSE_GATEWAY,
} from './alert.gateway';

import {
  AlertFacade,
} from './alert.facade';

import { HttpAlertGateway } from './http-alert.gateway';

/** Registers the real Alert & Response HTTP adapter. */
export function provideAlertResponseDataAccess():
  EnvironmentProviders {

  return makeEnvironmentProviders([

    AlertFacade,

    {
      provide:
        ALERT_RESPONSE_GATEWAY,

      useClass: HttpAlertGateway,
    },
  ]);
}
