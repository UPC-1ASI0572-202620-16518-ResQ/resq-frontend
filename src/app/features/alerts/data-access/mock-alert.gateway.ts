import { Injectable, signal } from '@angular/core';

import {
  Observable,
  delay,
  of,
  throwError,
} from 'rxjs';

import {
  ApiError,
} from '../../../core/api/api-error';

import { RiskEventStoreService } from '../../../core/services/risk-event-store.service';
import { AuthorizationService } from '../../auth/authorization.service';

import {
  AlertQueryFilters,
  AlertRecord,
  AlertResponseGateway,
  AuthorizationDecision,
  ConfigureResponsePolicyInput,
  ResponseActionInput,
  ResponseExecutionQueryFilters,
  ResponseExecutionRecord,
  ResponsePolicyRecord,
  UpdateResponsePolicyInput,
} from './alert.gateway';

import {
  mapLegacyAlertToRecord,
  mapLegacyResponseExecutionToRecord,
} from './alert.mapper';

@Injectable()
export class MockAlertGateway
  implements AlertResponseGateway {

  /*
   * The current frontend mock has no predefined
   * ResponsePolicy catalog.
   *
   * Policies created through the future management
   * surface are stored here in memory.
   */
  private readonly policies =
    signal<
      ResponsePolicyRecord[]
    >(
      [],
    );

  constructor(
    private readonly authorization: AuthorizationService,
    private readonly events:
      RiskEventStoreService,
  ) {}

  getAlerts(
    filters:
      AlertQueryFilters,
  ):
    Observable<
      AlertRecord[]
    > {

    const result =
      this.alertRecords()
        .filter(
          alert =>
            !filters.buildingId ||
            alert.context
              .buildingId ===
              filters.buildingId,
        )
        .filter(
          alert =>
            !filters.zoneId ||
            alert.context
              .zoneId ===
              filters.zoneId,
        )
        .filter(
          alert =>
            !filters.riskTypeCode ||
            alert.context
              .riskTypeCode ===
              filters.riskTypeCode,
        )
        .filter(
          alert =>
            !filters.from ||
            alert.generatedAt
              .getTime() >=
              filters.from
                .getTime(),
        )
        .filter(
          alert =>
            !filters.to ||
            alert.generatedAt
              .getTime() <=
              filters.to
                .getTime(),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.generatedAt
              .getTime() -
            left.generatedAt
              .getTime(),
        )
        .map(
          cloneAlert,
        );

    return of(
      result,
    ).pipe(
      delay(80),
    );
  }

  getAlertById(
    alertId: string,
  ):
    Observable<
      AlertRecord
      | undefined
    > {

    const alert =
      this.alertRecords().find(
        item =>
          item.alertId ===
          alertId,
      );

    return of(
      alert
        ? cloneAlert(
            alert,
          )
        : undefined,
    ).pipe(
      delay(60),
    );
  }

  getResponseExecutions(
    filters:
      ResponseExecutionQueryFilters,
  ):
    Observable<
      ResponseExecutionRecord[]
    > {

    const result =
      this.executionRecords()
        .filter(
          execution =>
            !filters.riskDetectionId ||
            execution
              .riskDetectionId ===
              filters
                .riskDetectionId,
        )
        .filter(
          execution =>
            !filters.status ||
            execution.status ===
              filters.status,
        )
        .filter(
          execution =>
            !filters.from ||
            execution.requestedAt
              .getTime() >=
              filters.from
                .getTime(),
        )
        .filter(
          execution =>
            !filters.to ||
            execution.requestedAt
              .getTime() <=
              filters.to
                .getTime(),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.requestedAt
              .getTime() -
            left.requestedAt
              .getTime(),
        )
        .map(
          cloneExecution,
        );

    return of(
      result,
    ).pipe(
      delay(80),
    );
  }

  getResponseExecutionById(
    responseExecutionId: string,
  ):
    Observable<
      ResponseExecutionRecord
      | undefined
    > {

    const execution =
      this.executionRecords().find(
        item =>
          item.responseExecutionId ===
          responseExecutionId,
      );

    return of(
      execution
        ? cloneExecution(
            execution,
          )
        : undefined,
    ).pipe(
      delay(60),
    );
  }

  decideResponseAuthorization(
    responseExecutionId: string,

    decision:
      AuthorizationDecision,
  ):
    Observable<
      ResponseExecutionRecord
    > {

    const execution =
      this.executionRecords().find(
        item =>
          item.responseExecutionId ===
          responseExecutionId,
      );

    if (!execution) {

      return throwError(
        () =>
          notFound(
            'RESPONSE_EXECUTION_NOT_FOUND',

            'The requested response execution was not found.',
          ),
      );
    }

    if (
      execution.action
        .authorizationMode !==
      'HUMAN_REQUIRED'
    ) {

      return throwError(
        () =>
          conflict(
            'AUTHORIZATION_NOT_REQUIRED',

            'This response execution does not require human authorization.',
          ),
      );
    }

    if (
      execution.status !==
      'PENDING_AUTHORIZATION'
    ) {

      return throwError(
        () =>
          conflict(
            'RESPONSE_EXECUTION_NOT_PENDING_AUTHORIZATION',

            'A decision can only be registered while the response execution is pending authorization.',
          ),
      );
    }

    if (
      execution.authorization
    ) {

      return throwError(
        () =>
          conflict(
            'AUTHORIZATION_ALREADY_DECIDED',

            'An authorization decision has already been registered.',
          ),
      );
    }

    let currentUserId: string;
    try {
      currentUserId = this.authorization.requireCriticalResponseAuthorizer().userId!;
    } catch (error) {
      return throwError(() => error);
    }

    const incident = this.events.incidentForDetection(execution.riskDetectionId);
    if (!incident || incident.status !== 'InProgress' || incident.assignedTo !== currentUserId) {
      return throwError(
        () =>
          conflict(
            'INCIDENT_ASSIGNMENT_REQUIRED',
            'Assign this Incident to your administrator user before authorizing critical actions.',
          ),
      );
    }

    const decidedAt = new Date();

    const next:
      ResponseExecutionRecord = {

      ...cloneExecution(
        execution,
      ),

      status:
        decision ===
        'APPROVED'
          ? 'SUCCEEDED'
          : 'REJECTED',

      authorization: {

        authorizationId:
          createLocalId(
            'authorization',
          ),

        decision,

        decidedByUserId: currentUserId,

        decidedAt,
      },

      executionRequestedAt: decision === 'APPROVED' ? decidedAt : undefined,

      result:
        decision === 'APPROVED'
          ? {
              successful: true,
              resultCode: 'ACTUATOR_CONFIRMED',
              message: 'Authorized action was requested and completed successfully.',
              completedAt: decidedAt,
            }
          : undefined,
    };

    const source = this.events.responseExecutions().find(
      (item) => item.responseExecutionId === responseExecutionId,
    );
    if (source) {
      const decided = {
        ...source,
        authorization: next.authorization,
        status: decision === 'APPROVED' ? 'AUTHORIZED' : 'REJECTED',
      } as const;
      this.events.updateResponseExecution(decided);

      if (decision === 'APPROVED') {
        const requested = {
          ...decided,
          status: 'EXECUTION_REQUESTED' as const,
          executionRequestedAt: decidedAt,
        };
        this.events.updateResponseExecution(requested);
        this.events.updateResponseExecution({
          ...requested,
          status: 'SUCCEEDED',
          result: next.result,
        });
      }
    }

    return of(
      cloneExecution(
        next,
      ),
    ).pipe(
      delay(100),
    );
  }

  getResponsePolicy(
    policyId: string,
  ):
    Observable<
      ResponsePolicyRecord
      | undefined
    > {

    const policy =
      this.policies().find(
        item =>
          item.policyId ===
          policyId,
      );

    return of(
      policy
        ? clonePolicy(
            policy,
          )
        : undefined,
    ).pipe(
      delay(60),
    );
  }

  configureResponsePolicy(
    input:
      ConfigureResponsePolicyInput,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    const error =
      validatePolicyInput(
        input,
      );

    if (error) {

      return throwError(
        () =>
          error,
      );
    }

    const policy:
      ResponsePolicyRecord = {

      policyId:
        createLocalId(
          'policy',
        ),

      /*
       * Temporary organization context used by
       * the current mock environment.
       *
       * The real backend obtains organizationId
       * from the authorized request context.
       */
      organizationId:
        'securitybear',

      riskTypeCode:
        input.riskTypeCode
          .trim(),

      status:
        'INACTIVE',

      actions:
        buildActions(
          input.actions,
        ),

      version:
        1,
    };

    this.policies.update(
      items => [
        ...items,
        policy,
      ],
    );

    return of(
      clonePolicy(
        policy,
      ),
    ).pipe(
      delay(100),
    );
  }

  updateResponsePolicy(
    policyId: string,

    input:
      UpdateResponsePolicyInput,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    const current =
      this.policies().find(
        item =>
          item.policyId ===
          policyId,
      );

    if (!current) {

      return throwError(
        () =>
          notFound(
            'RESPONSE_POLICY_NOT_FOUND',

            'The requested response policy was not found.',
          ),
      );
    }

    const error =
      validatePolicyInput(
        input,
      );

    if (error) {

      return throwError(
        () =>
          error,
      );
    }

    if (
      current.status ===
        'ACTIVE' &&
      input.actions.length === 0
    ) {

      return throwError(
        () =>
          conflict(
            'ACTIVE_POLICY_REQUIRES_ACTION',

            'An active response policy must contain at least one valid action.',
          ),
      );
    }

    const next:
      ResponsePolicyRecord = {

      ...current,

      riskTypeCode:
        input.riskTypeCode
          .trim(),

      actions:
        buildActions(
          input.actions,
        ),

      version:
        current.version +
        1,
    };

    this.policies.update(
      items =>
        items.map(
          item =>
            item.policyId ===
            policyId
              ? next
              : item,
        ),
    );

    return of(
      clonePolicy(
        next,
      ),
    ).pipe(
      delay(90),
    );
  }

  changeResponsePolicyStatus(
    policyId: string,

    active: boolean,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    const current =
      this.policies().find(
        item =>
          item.policyId ===
          policyId,
      );

    if (!current) {

      return throwError(
        () =>
          notFound(
            'RESPONSE_POLICY_NOT_FOUND',

            'The requested response policy was not found.',
          ),
      );
    }

    if (
      active &&
      current.actions.length === 0
    ) {

      return throwError(
        () =>
          conflict(
            'RESPONSE_POLICY_HAS_NO_ACTIONS',

            'A response policy must contain at least one valid action before it can be activated.',
          ),
      );
    }

    const targetStatus =
      active
        ? 'ACTIVE'
        : 'INACTIVE';

    if (
      current.status ===
      targetStatus
    ) {

      return of(
        clonePolicy(
          current,
        ),
      ).pipe(
        delay(60),
      );
    }

    const next:
      ResponsePolicyRecord = {

      ...current,

      status:
        targetStatus,

      version:
        current.version +
        1,
    };

    this.policies.update(
      items =>
        items.map(
          item =>
            item.policyId ===
            policyId
              ? next
              : item,
        ),
    );

    return of(
      clonePolicy(
        next,
      ),
    ).pipe(
      delay(90),
    );
  }

  private alertRecords(): AlertRecord[] {
    return this.events.alerts().map(mapLegacyAlertToRecord);
  }

  private executionRecords(): ResponseExecutionRecord[] {
    return this.events.responseExecutions().map(mapLegacyResponseExecutionToRecord);
  }
}

function validatePolicyInput(
  input:
    ConfigureResponsePolicyInput,
):
  ApiError
  | undefined {

  if (
    !input.riskTypeCode
      .trim()
  ) {

    return badRequest(
      'RISK_TYPE_REQUIRED',

      'A risk type is required.',
    );
  }

  const actionCodes =
    new Set<string>();

  for (
    const action
    of input.actions
  ) {

    if (
      !action.actionCode
        .trim()
    ) {

      return badRequest(
        'ACTION_CODE_REQUIRED',

        'Each response action requires an action code.',
      );
    }

    if (
      !action.targetDeviceId
        .trim()
    ) {

      return badRequest(
        'TARGET_DEVICE_REQUIRED',

        'Each response action requires a target device.',
      );
    }

    if (
      !action
        .targetCapabilityCode
        .trim()
    ) {

      return badRequest(
        'TARGET_CAPABILITY_REQUIRED',

        'Each response action requires a target capability.',
      );
    }

    const normalizedCode =
      action.actionCode
        .trim();

    if (
      actionCodes.has(
        normalizedCode,
      )
    ) {

      return badRequest(
        'DUPLICATE_ACTION_CODE',

        'Response action codes must be unique within the policy.',
      );
    }

    actionCodes.add(
      normalizedCode,
    );
  }

  return undefined;
}

function buildActions(
  actions:
    ResponseActionInput[],
) {

  return actions.map(
    action => ({

      actionId:
        createLocalId(
          'response-action',
        ),

      actionCode:
        action.actionCode
          .trim(),

      targetDeviceId:
        action.targetDeviceId
          .trim(),

      targetCapabilityCode:
        action
          .targetCapabilityCode
          .trim(),

      authorizationMode:
        action.authorizationMode,

      critical:
        action.critical,
    }),
  );
}

function cloneAlert(
  alert:
    AlertRecord,
):
  AlertRecord {

  return {
    ...alert,

    context: {
      ...alert.context,

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

    clearedAt: alert.clearedAt ? new Date(alert.clearedAt) : undefined,

    deliveries:
      alert.deliveries.map(
        delivery => ({

          ...delivery,

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
        }),
      ),
  };
}

function cloneExecution(
  execution:
    ResponseExecutionRecord,
):
  ResponseExecutionRecord {

  return {
    ...execution,

    action: {
      ...execution.action,
    },

    requestedAt:
      new Date(
        execution.requestedAt,
      ),

    executionRequestedAt: execution.executionRequestedAt
      ? new Date(execution.executionRequestedAt)
      : undefined,

    authorization:
      execution.authorization
        ? {
            ...execution.authorization,

            decidedAt:
              new Date(
                execution
                  .authorization
                  .decidedAt,
              ),
          }
        : undefined,

    result:
      execution.result
        ? {
            ...execution.result,

            completedAt:
              new Date(
                execution.result
                  .completedAt,
              ),
          }
        : undefined,
  };
}

function clonePolicy(
  policy:
    ResponsePolicyRecord,
):
  ResponsePolicyRecord {

  return {
    ...policy,

    actions:
      policy.actions.map(
        action => ({
          ...action,
        }),
      ),
  };
}

function createLocalId(
  prefix: string,
): string {

  return (
    globalThis.crypto
      ?.randomUUID?.()
    ??
    `${prefix}-${Date.now()}`
  );
}

function apiError(
  status: number,

  code: string,

  message: string,
):
  ApiError {

  return {
    status,
    code,
    message,
    fieldErrors: [],
  };
}

function badRequest(
  code: string,

  message: string,
):
  ApiError {

  return apiError(
    400,
    code,
    message,
  );
}

function conflict(
  code: string,

  message: string,
):
  ApiError {

  return apiError(
    409,
    code,
    message,
  );
}

function notFound(
  code: string,

  message: string,
):
  ApiError {

  return apiError(
    404,
    code,
    message,
  );
}
