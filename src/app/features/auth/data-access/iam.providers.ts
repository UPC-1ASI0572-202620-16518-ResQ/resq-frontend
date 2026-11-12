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

import { HttpIamGateway } from './http-iam.gateway';

/** Registers the real IAM HTTP adapter. */
export function provideIamDataAccess():
  EnvironmentProviders {

  return makeEnvironmentProviders([

    IamFacade,

    {
      provide:
        IAM_GATEWAY,

      useClass: HttpIamGateway,
    },
  ]);
}
