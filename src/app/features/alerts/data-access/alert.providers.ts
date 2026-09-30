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

import {
  MockAlertGateway,
} from './mock-alert.gateway';

/**
 * Alert & Response Management currently operates
 * with the mock adapter.
 *
 * We intentionally do not expose a "mock | http"
 * selector yet because the Project Report describes
 * its REST resources as conceptual examples.
 *
 * When backend publishes the final contract,
 * HttpAlertGateway can replace MockAlertGateway here
 * without changing the Pages or Facades.
 */
export function provideAlertResponseDataAccess():
  EnvironmentProviders {

  return makeEnvironmentProviders([

    AlertFacade,

    {
      provide:
        ALERT_RESPONSE_GATEWAY,

      useClass:
        MockAlertGateway,
    },
  ]);
}