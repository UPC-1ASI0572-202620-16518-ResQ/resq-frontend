import { SubscriptionResourceDto } from './subscription.dto';
import { SubscriptionRecord, SubscriptionStatus } from './subscription.gateway';

export function mapSubscriptionResourceDto(dto: SubscriptionResourceDto): SubscriptionRecord {
  return {
    id: dto.id,
    organizationId: dto.organizationId,
    status: dto.status.toUpperCase() as SubscriptionStatus,
    startDate: new Date(dto.startDate),
    endDate: new Date(dto.endDate)
  };
}
