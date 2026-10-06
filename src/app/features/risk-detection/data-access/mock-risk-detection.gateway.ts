import {
  Injectable,
  signal,
} from '@angular/core';

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

import {
  cloneRiskDetection,
  mapLegacyRiskDetectionToRecord,
} from './risk-detection.mapper';

import {
  ComparisonOperator,
  ConfigureDetectionRuleInput,
  DetectionRuleRecord,
  RiskDetectionGateway,
  RiskDetectionRecord,
} from './risk-detection.gateway';

@Injectable()
export class MockRiskDetectionGateway
  implements RiskDetectionGateway {

  /*
   * The current legacy frontend has no
   * persisted detection-rule catalog.
   *
   * New rules configured during mock mode
   * live only in memory.
   */
  private readonly rules =
    signal<
      DetectionRuleRecord[]
    >(
      [],
    );

  constructor(private readonly events: RiskEventStoreService) {
    const seeded = new Map<string, DetectionRuleRecord>();
    for (const detection of events.detections()) {
      const evidence = detection.evidence[0];
      const threshold =
        detection.severityCode === 'Critical'
          ? evidence?.criticalThreshold
          : evidence?.warningThreshold;
      if (!evidence || threshold === undefined) continue;
      seeded.set(detection.ruleId, {
        ruleId: detection.ruleId,
        riskTypeCode: detection.riskTypeCode,
        severityCode: detection.severityCode,
        condition: {
          variableType: evidence.metric,
          operator: 'GREATER_THAN_OR_EQUAL',
          threshold,
        },
        status: 'ACTIVE',
      });
    }
    this.rules.set([...seeded.values()]);
  }

  getRiskDetectionById(
    riskDetectionId: string,
  ):
    Observable<
      RiskDetectionRecord
      | undefined
    > {

    const detection =
      this.detectionRecords().find(
        item =>
          item.riskDetectionId ===
          riskDetectionId,
      );

    return of(
      detection
        ? cloneRiskDetection(
            detection,
          )
        : undefined,
    ).pipe(
      delay(60),
    );
  }

  getRiskDetectionEvidence(
    riskDetectionId: string,
  ):
    Observable<
      RiskDetectionRecord
      | undefined
    > {

    /*
     * The domain stores evidence as part of
     * RiskDetection.
     *
     * The future backend may expose evidence
     * through a dedicated query resource.
     */
    const detection =
      this.detectionRecords().find(
        item =>
          item.riskDetectionId ===
          riskDetectionId,
      );

    return of(
      detection
        ? cloneRiskDetection(
            detection,
          )
        : undefined,
    ).pipe(
      delay(70),
    );
  }

  configureDetectionRule(
    input:
      ConfigureDetectionRuleInput,
  ):
    Observable<
      DetectionRuleRecord
    > {

    const validationError =
      validateRuleInput(
        input,
      );

    if (
      validationError
    ) {

      return throwError(
        () =>
          validationError,
      );
    }

    const rule:
      DetectionRuleRecord = {

      ruleId:
        createLocalId(
          'detection-rule',
        ),

      riskTypeCode:
        input.riskTypeCode
          .trim(),

      severityCode:
        input.severityCode
          .trim(),

      condition: {

        variableType:
          input.variableType
            .trim(),

        operator:
          input.operator,

        threshold:
          input.threshold,
      },

      /*
       * The Report defines status changes through
       * a separate command.
       *
       * For mock-mode safety a newly configured
       * rule starts INACTIVE and must be explicitly
       * activated.
       *
       * Backend behavior must be confirmed through
       * its final API contract.
       */
      status:
        'INACTIVE',
    };

    this.rules.update(
      rules => [
        ...rules,
        rule,
      ],
    );

    return of(
      cloneRule(
        rule,
      ),
    ).pipe(
      delay(100),
    );
  }

  changeDetectionRuleStatus(
    ruleId: string,

    active: boolean,
  ):
    Observable<
      DetectionRuleRecord
    > {

    const current =
      this.rules().find(
        rule =>
          rule.ruleId ===
          ruleId,
      );

    if (!current) {

      return throwError(
        () =>
          notFound(),
      );
    }

    if (
      active &&
      !isValidCondition(
        current.condition
          .variableType,

        current.condition
          .operator,

        current.condition
          .threshold,
      )
    ) {

      return throwError(
        () =>
          conflict(
            'INVALID_DETECTION_RULE',

            'An invalid detection rule cannot be activated.',
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
        cloneRule(
          current,
        ),
      ).pipe(
        delay(60),
      );
    }

    const next:
      DetectionRuleRecord = {

      ...current,

      status:
        targetStatus,
    };

    this.rules.update(
      rules =>
        rules.map(
          rule =>
            rule.ruleId ===
            ruleId
              ? next
              : rule,
        ),
    );

    return of(
      cloneRule(
        next,
      ),
    ).pipe(
      delay(90),
    );
  }

  private detectionRecords(): RiskDetectionRecord[] {
    return this.events.detections().map(mapLegacyRiskDetectionToRecord);
  }
}

function validateRuleInput(
  input:
    ConfigureDetectionRuleInput,
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

  if (
    !input.severityCode
      .trim()
  ) {

    return badRequest(
      'SEVERITY_REQUIRED',

      'A severity level is required.',
    );
  }

  if (
    !input.variableType
      .trim()
  ) {

    return badRequest(
      'VARIABLE_TYPE_REQUIRED',

      'A monitored variable is required.',
    );
  }

  if (
    !isValidCondition(
      input.variableType,
      input.operator,
      input.threshold,
    )
  ) {

    return badRequest(
      'INVALID_DETECTION_CONDITION',

      'The detection condition is invalid.',
    );
  }

  return undefined;
}

function isValidCondition(
  variableType: string,

  operator:
    ComparisonOperator,

  threshold: number,
): boolean {

  const validOperators:
    ComparisonOperator[] = [

    'GREATER_THAN',

    'GREATER_THAN_OR_EQUAL',

    'LESS_THAN',

    'LESS_THAN_OR_EQUAL',

    'EQUAL',
  ];

  return (
    variableType
      .trim()
      .length > 0 &&

    validOperators.includes(
      operator,
    ) &&

    Number.isFinite(
      threshold,
    )
  );
}

function cloneRule(
  rule:
    DetectionRuleRecord,
):
  DetectionRuleRecord {

  return {
    ...rule,

    condition: {
      ...rule.condition,
    },
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

function notFound():
  ApiError {

  return apiError(
    404,

    'DETECTION_RULE_NOT_FOUND',

    'The requested detection rule was not found.',
  );
}
