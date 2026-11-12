import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import {
  RISK_DETECTION_GATEWAY,
} from './risk-detection.gateway';

import {
  RiskDetectionFacade,
} from './risk-detection.facade';

import { HttpRiskDetectionGateway } from './http-risk-detection.gateway';

/** Registers the real Risk Detection HTTP adapter. */
export function provideRiskDetectionDataAccess():
  EnvironmentProviders {

  return makeEnvironmentProviders([

    RiskDetectionFacade,

    {
      provide:
        RISK_DETECTION_GATEWAY,

      useClass: HttpRiskDetectionGateway,
    },
  ]);
}
