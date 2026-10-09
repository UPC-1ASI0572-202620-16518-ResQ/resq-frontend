import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED';

export interface SubscriptionRecord {
  id: string;
  organizationId: string;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
}

export interface CreateSubscriptionInput {
  startDate: Date;
  endDate: Date;
}

export interface RenewSubscriptionInput {
  newEndDate: Date;
}

export interface SubscriptionGateway {
  getMySubscription(): Observable<SubscriptionRecord | undefined>;
  createSubscription(input: CreateSubscriptionInput): Observable<SubscriptionRecord>;
  renewSubscription(id: string, input: RenewSubscriptionInput): Observable<SubscriptionRecord>;
  cancelSubscription(id: string): Observable<SubscriptionRecord>;
  expireSubscription(id: string): Observable<SubscriptionRecord>;
}

export const SUBSCRIPTION_GATEWAY = new InjectionToken<SubscriptionGateway>('SUBSCRIPTION_GATEWAY');
