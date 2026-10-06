import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

export type NotificationDeliveryStatus =
  | 'PENDING'
  | 'DELIVERED'
  | 'FAILED';

export type AuthorizationMode =
  | 'AUTOMATIC'
  | 'HUMAN_REQUIRED';

export type AuthorizationDecision =
  | 'APPROVED'
  | 'REJECTED';

export type ResponseExecutionStatus =
  | 'PENDING'
  | 'PENDING_AUTHORIZATION'
  | 'AUTHORIZED'
  | 'EXECUTION_REQUESTED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED';

export type ResponsePolicyStatus =
  | 'ACTIVE'
  | 'INACTIVE';

export interface AlertContextRecord {
  riskDetectionId: string;

  riskTypeCode: string;

  severityCode: string;

  buildingId?: string;

  zoneId?: string;

  detectedAt: Date;
}

export interface NotificationDeliveryRecord {
  deliveryId: string;

  recipientUserId: string;

  channel: string;

  destination: string;

  status:
    NotificationDeliveryStatus;

  requestedAt: Date;

  completedAt?: Date;

  failureReason?: string;
}

export interface AlertRecord {
  alertId: string;

  organizationId: string;

  context:
    AlertContextRecord;

  generatedAt: Date;

  status: 'ACTIVE' | 'CLEARED';

  clearedAt?: Date;

  clearReason?: 'RETURNED_TO_NORMAL' | 'CRITICAL_THRESHOLD_REACHED';

  deliveries:
    NotificationDeliveryRecord[];
}

export interface ResponseActionSnapshotRecord {
  actionId: string;

  actionCode: string;

  targetDeviceId: string;

  targetCapabilityCode: string;

  authorizationMode:
    AuthorizationMode;

  critical: boolean;
}

export interface ResponseAuthorizationRecord {
  authorizationId: string;

  decision:
    AuthorizationDecision;

  decidedByUserId: string;

  decidedAt: Date;
}

export interface ExecutionResultRecord {
  successful: boolean;

  resultCode: string;

  message?: string;

  completedAt: Date;
}

export interface ResponseExecutionRecord {
  responseExecutionId: string;

  organizationId: string;

  riskDetectionId: string;

  policyId: string;

  action:
    ResponseActionSnapshotRecord;

  status:
    ResponseExecutionStatus;

  requestedAt: Date;

  executionRequestedAt?: Date;

  authorization?:
    ResponseAuthorizationRecord;

  result?:
    ExecutionResultRecord;
}

export interface ResponseActionRecord {
  actionId: string;

  actionCode: string;

  targetDeviceId: string;

  targetCapabilityCode: string;

  authorizationMode:
    AuthorizationMode;

  critical: boolean;
}

export interface ResponsePolicyRecord {
  policyId: string;

  organizationId: string;

  riskTypeCode: string;

  status:
    ResponsePolicyStatus;

  actions:
    ResponseActionRecord[];

  version: number;
}

export interface ResponseActionInput {
  actionCode: string;

  targetDeviceId: string;

  targetCapabilityCode: string;

  authorizationMode:
    AuthorizationMode;

  critical: boolean;
}

export interface ConfigureResponsePolicyInput {
  riskTypeCode: string;

  actions:
    ResponseActionInput[];
}

export interface UpdateResponsePolicyInput {
  riskTypeCode: string;

  actions:
    ResponseActionInput[];
}

export interface AlertQueryFilters {
  buildingId?: string;

  zoneId?: string;

  riskTypeCode?: string;

  from?: Date;

  to?: Date;
}

export interface ResponseExecutionQueryFilters {
  riskDetectionId?: string;

  status?:
    ResponseExecutionStatus;

  from?: Date;

  to?: Date;
}

export interface AlertResponseGateway {

  getAlerts(
    filters:
      AlertQueryFilters,
  ):
    Observable<
      AlertRecord[]
    >;

  getAlertById(
    alertId: string,
  ):
    Observable<
      AlertRecord
      | undefined
    >;

  getResponseExecutions(
    filters:
      ResponseExecutionQueryFilters,
  ):
    Observable<
      ResponseExecutionRecord[]
    >;

  getResponseExecutionById(
    responseExecutionId: string,
  ):
    Observable<
      ResponseExecutionRecord
      | undefined
    >;

  decideResponseAuthorization(
    responseExecutionId: string,

    decision:
      AuthorizationDecision,
  ):
    Observable<
      ResponseExecutionRecord
    >;

  getResponsePolicy(
    policyId: string,
  ):
    Observable<
      ResponsePolicyRecord
      | undefined
    >;

  configureResponsePolicy(
    input:
      ConfigureResponsePolicyInput,
  ):
    Observable<
      ResponsePolicyRecord
    >;

  updateResponsePolicy(
    policyId: string,

    input:
      UpdateResponsePolicyInput,
  ):
    Observable<
      ResponsePolicyRecord
    >;

  changeResponsePolicyStatus(
    policyId: string,

    active: boolean,
  ):
    Observable<
      ResponsePolicyRecord
    >;
}

export const ALERT_RESPONSE_GATEWAY =
  new InjectionToken<AlertResponseGateway>(
    'ALERT_RESPONSE_GATEWAY',
  );
