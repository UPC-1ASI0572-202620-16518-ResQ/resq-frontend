export type NotificationDeliveryStatusDto =
  | 'PENDING'
  | 'DELIVERED'
  | 'FAILED';

export type AuthorizationModeDto =
  | 'AUTOMATIC'
  | 'HUMAN_REQUIRED';

export type AuthorizationDecisionDto =
  | 'APPROVED'
  | 'REJECTED';

export type ResponseExecutionStatusDto =
  | 'PENDING'
  | 'PENDING_AUTHORIZATION'
  | 'AUTHORIZED'
  | 'EXECUTION_REQUESTED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED';

export type ResponsePolicyStatusDto =
  | 'ACTIVE'
  | 'INACTIVE';

export interface AlertContextResourceDto {
  riskDetectionId: string;

  riskTypeCode: string;

  severityCode: string;

  buildingId?: string | null;

  zoneId?: string | null;

  detectedAt: string;
}

export interface NotificationDeliveryResourceDto {
  deliveryId: string;

  recipientUserId: string;

  channel: string;

  destination: string;

  status:
    NotificationDeliveryStatusDto;

  requestedAt: string;

  completedAt?:
    string
    | null;

  failureReason?:
    string
    | null;
}

export interface AlertResourceDto {
  alertId: string;

  organizationId: string;

  context:
    AlertContextResourceDto;

  generatedAt: string;

  /** TODO(OpenAPI): optional compatibility fields until backend contract is published. */
  status?: 'ACTIVE' | 'CLEARED';
  clearedAt?: string | null;
  clearReason?: 'RETURNED_TO_NORMAL' | 'CRITICAL_THRESHOLD_REACHED' | null;

  deliveries:
    NotificationDeliveryResourceDto[];
}

export interface ResponseActionSnapshotResourceDto {
  actionId: string;

  actionCode: string;

  targetDeviceId: string;

  targetCapabilityCode: string;

  authorizationMode:
    AuthorizationModeDto;

  critical: boolean;
}

export interface ResponseAuthorizationResourceDto {
  authorizationId: string;

  decision:
    AuthorizationDecisionDto;

  decidedByUserId: string;

  decidedAt: string;
}

export interface ExecutionResultResourceDto {
  successful: boolean;

  resultCode: string;

  message?:
    string
    | null;

  completedAt: string;
}

export interface ResponseExecutionResourceDto {
  responseExecutionId: string;

  organizationId: string;

  riskDetectionId: string;

  policyId: string;

  action:
    ResponseActionSnapshotResourceDto;

  status:
    ResponseExecutionStatusDto;

  requestedAt: string;

  /** TODO(OpenAPI): lifecycle timestamp pending final backend schema. */
  executionRequestedAt?: string | null;

  authorization?:
    ResponseAuthorizationResourceDto
    | null;

  result?:
    ExecutionResultResourceDto
    | null;
}

export interface DecideResponseAuthorizationResourceDto {
  decision:
    AuthorizationDecisionDto;
}

export interface ResponseActionResourceDto {
  actionId: string;

  actionCode: string;

  targetDeviceId: string;

  targetCapabilityCode: string;

  authorizationMode:
    AuthorizationModeDto;

  critical: boolean;
}

export interface ResponsePolicyResourceDto {
  policyId: string;

  organizationId: string;

  riskTypeCode: string;

  status:
    ResponsePolicyStatusDto;

  actions:
    ResponseActionResourceDto[];

  version: number;
}

export interface ResponseActionDataResourceDto {
  actionCode: string;

  targetDeviceId: string;

  targetCapabilityCode: string;

  authorizationMode:
    AuthorizationModeDto;

  critical: boolean;
}

export interface ConfigureResponsePolicyResourceDto {
  riskTypeCode: string;

  actions:
    ResponseActionDataResourceDto[];
}

export interface UpdateResponsePolicyResourceDto {
  riskTypeCode: string;

  actions:
    ResponseActionDataResourceDto[];
}

export interface ChangeResponsePolicyStatusResourceDto {
  active: boolean;
}
