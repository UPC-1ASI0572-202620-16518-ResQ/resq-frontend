import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  IAM_GATEWAY,
} from './iam.gateway';

import {
  IamFacade,
} from './iam.facade';

import {
  MockIamGateway,
} from './mock-iam.gateway';

/**
 * IAM stays on the mock implementation until the
 * backend authentication/session contract is final.
 *
 * HttpIamGateway already exists as the future seam
 * but is intentionally not selectable yet.
 */
export function provideIamDataAccess():
  EnvironmentProviders {

  return makeEnvironmentProviders([

    IamFacade,

    {
      provide:
        IAM_GATEWAY,

      useClass:
        MockIamGateway,
    },
  ]);
}