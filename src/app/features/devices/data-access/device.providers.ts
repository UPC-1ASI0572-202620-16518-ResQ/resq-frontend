import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  DEVICE_GATEWAY,
} from './device.gateway';

import {
  DeviceFacade,
} from './device.facade';

import {
  HttpDeviceGateway,
} from './http-device.gateway';

import {
  MockDeviceGateway,
} from './mock-device.gateway';

export type DeviceDataSource =
  'mock'
  | 'http';

export function provideDeviceDataAccess(
  source:
    DeviceDataSource = 'mock',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    DeviceFacade,

    {
      provide:
        DEVICE_GATEWAY,

      useClass:
        source === 'http'
          ? HttpDeviceGateway
          : MockDeviceGateway,
    },
  ]);
}