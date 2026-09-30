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

import {
  MockRiskDetectionGateway,
} from './mock-risk-detection.gateway';

/**
 * Risk Detection remains on the mock adapter
 * until backend confirms the final REST resources
 * and publishes the API contract.
 */
export function provideRiskDetectionDataAccess():
  EnvironmentProviders {

  return makeEnvironmentProviders([

    RiskDetectionFacade,

    {
      provide:
        RISK_DETECTION_GATEWAY,

      useClass:
        MockRiskDetectionGateway,
    },
  ]);
}