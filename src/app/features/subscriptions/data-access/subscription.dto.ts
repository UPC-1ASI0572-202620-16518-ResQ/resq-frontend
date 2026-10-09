export type SubscriptionStatusDto = 'active' | 'cancelled' | 'expired';

export interface SubscriptionResourceDto {
  id: string;
  organizationId: string;
  status: SubscriptionStatusDto;
  startDate: string;
  endDate: string;
}

export interface CreateSubscriptionResourceDto {
  startDate: string;
  endDate: string;
}

export interface RenewSubscriptionResourceDto {
  newEndDate: string;
}
