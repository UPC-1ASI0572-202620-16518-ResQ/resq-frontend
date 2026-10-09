import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { SUBSCRIPTION_GATEWAY } from './subscription.gateway';
import { HttpSubscriptionGateway } from './http-subscription.gateway';
import { MockSubscriptionGateway } from './mock-subscription.gateway';

export function provideSubscriptionDataAccess(source: 'mock' | 'http' = 'mock'): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SUBSCRIPTION_GATEWAY,
      useClass: source === 'http' ? HttpSubscriptionGateway : MockSubscriptionGateway,
    },
  ]);
}
