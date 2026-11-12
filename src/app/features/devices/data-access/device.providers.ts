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

export type DeviceDataSource = 'http';

export function provideDeviceDataAccess(
  source:
    DeviceDataSource = 'http',
):
  EnvironmentProviders {

  return makeEnvironmentProviders([

    DeviceFacade,

    {
      provide:
        DEVICE_GATEWAY,

      useClass: HttpDeviceGateway,
    },
  ]);
}
