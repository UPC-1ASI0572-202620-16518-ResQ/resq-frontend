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

import {
  MockUserGateway,
} from './mock-user.gateway';

export type UserDataSource =
  | 'mock'
  | 'http';

export function provideUserDataAccess(
  source:
    UserDataSource = 'mock',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    UserFacade,

    {
      provide:
        USER_GATEWAY,

      useClass:
        source === 'http'
          ? HttpUserGateway
          : MockUserGateway,
    },
  ]);
}