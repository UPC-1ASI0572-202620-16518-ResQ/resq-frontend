import {
  Alert as LegacyAlert,
  ResponseExecution as LegacyResponseExecution,
} from '../../../core/models/resq.models';

import {
  AlertResourceDto,
  ConfigureResponsePolicyResourceDto,
  DecideResponseAuthorizationResourceDto,
  ResponseExecutionResourceDto,
  ResponsePolicyResourceDto,
  UpdateResponsePolicyResourceDto,
} from './alert.dto';

import {
  AlertRecord,
  AuthorizationDecision,
  ConfigureResponsePolicyInput,
  ResponseExecutionRecord,
  ResponsePolicyRecord,
  UpdateResponsePolicyInput,
} from './alert.gateway';

export function mapAlertResourceDto(
  dto:
    AlertResourceDto,
):
  AlertRecord {

  return {
    alertId:
      dto.alertId,

    organizationId:
      dto.organizationId,

    context: {

      riskDetectionId:
        dto.context
          .riskDetectionId,

      riskTypeCode:
        dto.context
          .riskTypeCode,

      severityCode:
        dto.context
          .severityCode,

      buildingId:
        dto.context
          .buildingId ??
        undefined,

      zoneId:
        dto.context
          .zoneId ??
        undefined,

      detectedAt:
        new Date(
          dto.context
            .detectedAt,
        ),
    },

    generatedAt:
      new Date(
        dto.generatedAt,
      ),

    deliveries:
      dto.deliveries.map(
        delivery => ({

          deliveryId:
            delivery.deliveryId,

          recipientUserId:
            delivery.recipientUserId,

          channel:
            delivery.channel,

          destination:
            delivery.destination,

          status:
            delivery.status,

          requestedAt:
            new Date(
              delivery.requestedAt,
            ),

          completedAt:
            delivery.completedAt
              ? new Date(
                  delivery.completedAt,
                )
              : undefined,

          failureReason:
            delivery.failureReason ??
            undefined,
        }),
      ),
  };
}

export function mapResponseExecutionResourceDto(
  dto:
    ResponseExecutionResourceDto,
):
  ResponseExecutionRecord {

  return {
    responseExecutionId:
      dto.responseExecutionId,

    organizationId:
      dto.organizationId,

    riskDetectionId:
      dto.riskDetectionId,

    policyId:
      dto.policyId,

    action: {

      actionId:
        dto.action.actionId,

      actionCode:
        dto.action.actionCode,

      targetDeviceId:
        dto.action
          .targetDeviceId,

      targetCapabilityCode:
        dto.action
          .targetCapabilityCode,

      authorizationMode:
        dto.action
          .authorizationMode,

      critical:
        dto.action.critical,
    },

    status:
      dto.status,

    requestedAt:
      new Date(
        dto.requestedAt,
      ),

    authorization:
      dto.authorization
        ? {
            authorizationId:
              dto.authorization
                .authorizationId,

            decision:
              dto.authorization
                .decision,

            decidedByUserId:
              dto.authorization
                .decidedByUserId,

            decidedAt:
              new Date(
                dto.authorization
                  .decidedAt,
              ),
          }
        : undefined,

    result:
      dto.result
        ? {
            successful:
              dto.result
                .successful,

            resultCode:
              dto.result
                .resultCode,

            message:
              dto.result
                .message ??
              undefined,

            completedAt:
              new Date(
                dto.result
                  .completedAt,
              ),
          }
        : undefined,
  };
}

export function mapResponsePolicyResourceDto(
  dto:
    ResponsePolicyResourceDto,
):
  ResponsePolicyRecord {

  return {
    policyId:
      dto.policyId,

    organizationId:
      dto.organizationId,

    riskTypeCode:
      dto.riskTypeCode,

    status:
      dto.status,

    actions:
      dto.actions.map(
        action => ({

          actionId:
            action.actionId,

          actionCode:
            action.actionCode,

          targetDeviceId:
            action.targetDeviceId,

          targetCapabilityCode:
            action.targetCapabilityCode,

          authorizationMode:
            action.authorizationMode,

          critical:
            action.critical,
        }),
      ),

    version:
      dto.version,
  };
}

export function mapLegacyAlertToRecord(
  alert:
    LegacyAlert,
):
  AlertRecord {

  return {
    alertId:
      alert.alertId,

    organizationId:
      alert.organizationId,

    context: {

      riskDetectionId:
        alert.context
          .riskDetectionId,

      riskTypeCode:
        alert.context
          .riskTypeCode,

      severityCode:
        alert.context
          .severityCode,

      buildingId:
        alert.context
          .buildingId,

      zoneId:
        alert.context
          .zoneId,

      detectedAt:
        new Date(
          alert.context
            .detectedAt,
        ),
    },

    generatedAt:
      new Date(
        alert.generatedAt,
      ),

    deliveries:
      alert.deliveries.map(
        delivery => ({

          deliveryId:
            delivery.deliveryId,

          recipientUserId:
            delivery.recipientUserId,

          channel:
            delivery.channel,

          destination:
            delivery.destination,

          status:
            delivery.status,

          requestedAt:
            new Date(
              delivery.requestedAt,
            ),

          completedAt:
            delivery.completedAt
              ? new Date(
                  delivery.completedAt,
                )
              : undefined,

          failureReason:
            delivery.failureReason,
        }),
      ),
  };
}

export function mapLegacyResponseExecutionToRecord(
  execution:
    LegacyResponseExecution,
):
  ResponseExecutionRecord {

  return {
    responseExecutionId:
      execution
        .responseExecutionId,

    organizationId:
      execution.organizationId,

    riskDetectionId:
      execution.riskDetectionId,

    policyId:
      execution.policyId,

    action: {

      actionId:
        execution.action.actionId,

      actionCode:
        execution.action.actionCode,

      targetDeviceId:
        execution.action
          .targetDeviceId,

      targetCapabilityCode:
        execution.action
          .targetCapabilityCode,

      authorizationMode:
        execution.action
          .authorizationMode,

      critical:
        execution.action.critical,
    },

    status:
      execution.status,

    requestedAt:
      new Date(
        execution.requestedAt,
      ),

    result:
      execution.result
        ? {
            successful:
              execution.result
                .successful,

            resultCode:
              execution.result
                .resultCode,

            message:
              execution.result
                .message,

            completedAt:
              new Date(
                execution.result
                  .completedAt,
              ),
          }
        : undefined,
  };
}

export function toConfigureResponsePolicyResourceDto(
  input:
    ConfigureResponsePolicyInput,
):
  ConfigureResponsePolicyResourceDto {

  return {
    riskTypeCode:
      input.riskTypeCode,

    actions:
      input.actions.map(
        action => ({
          ...action,
        }),
      ),
  };
}

export function toUpdateResponsePolicyResourceDto(
  input:
    UpdateResponsePolicyInput,
):
  UpdateResponsePolicyResourceDto {

  return {
    riskTypeCode:
      input.riskTypeCode,

    actions:
      input.actions.map(
        action => ({
          ...action,
        }),
      ),
  };
}

export function toAuthorizationResourceDto(
  decision:
    AuthorizationDecision,
):
  DecideResponseAuthorizationResourceDto {

  return {
    decision,
  };
}