import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { SUBSCRIPTION_GATEWAY } from './subscription.gateway';
import { HttpSubscriptionGateway } from './http-subscription.gateway';

export function provideSubscriptionDataAccess(source: 'http' = 'http'): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SUBSCRIPTION_GATEWAY,
      useClass: HttpSubscriptionGateway,
    },
  ]);
}
