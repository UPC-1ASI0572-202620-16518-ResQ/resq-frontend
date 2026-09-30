import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  MONITORING_GATEWAY,
} from './monitoring.gateway';

import {
  MonitoringFacade,
} from './monitoring.facade';

import {
  MockMonitoringGateway,
} from './mock-monitoring.gateway';

export function provideMonitoringDataAccess():
  EnvironmentProviders {

  return makeEnvironmentProviders([

    MonitoringFacade,

    {
      provide:
        MONITORING_GATEWAY,

      useClass:
        MockMonitoringGateway,
    },
  ]);
}