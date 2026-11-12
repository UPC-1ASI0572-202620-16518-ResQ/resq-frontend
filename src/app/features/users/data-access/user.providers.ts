import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  USER_GATEWAY,
} from './user.gateway';

import {
  UserFacade,
} from './user.facade';

import {
  HttpUserGateway,
} from './http-user.gateway';

export type UserDataSource = 'http';

export function provideUserDataAccess(
  source:
    UserDataSource = 'http',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    UserFacade,

    {
      provide:
        USER_GATEWAY,

      useClass: HttpUserGateway,
    },
  ]);
}
