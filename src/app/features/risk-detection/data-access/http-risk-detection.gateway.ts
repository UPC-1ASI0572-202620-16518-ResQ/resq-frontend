import {
  Injectable,
} from '@angular/core';

import {
  Observable,
  throwError,
} from 'rxjs';

import {
  ApiError,
} from '../../../core/api/api-error';

import {
  ConfigureDetectionRuleInput,
  DetectionRuleRecord,
  RiskDetectionGateway,
  RiskDetectionRecord,
} from './risk-detection.gateway';

/**
 * Placeholder HTTP adapter for Risk Detection.
 *
 * The current Project Report describes resources
 * such as:
 *
 * POST  /api/v1/risk-detection/rules
 * PATCH /api/v1/risk-detection/rules/{ruleId}/status
 * GET   /api/v1/risk-detections/{riskDetectionId}
 * GET   /api/v1/risk-detections/{riskDetectionId}/evidence
 *
 * as conceptual REST examples.
 *
 * The adapter is therefore intentionally disabled
 * until backend publishes its final OpenAPI/Swagger
 * contract and resource schemas.
 */
@Injectable()
export class HttpRiskDetectionGateway
  implements RiskDetectionGateway {

  getRiskDetectionById(
    _riskDetectionId:
      string,
  ):
    Observable<
      RiskDetectionRecord
      | undefined
    > {

    return this.notFinalized(
      'getRiskDetectionById',
    );
  }

  getRiskDetectionEvidence(
    _riskDetectionId:
      string,
  ):
    Observable<
      RiskDetectionRecord
      | undefined
    > {

    return this.notFinalized(
      'getRiskDetectionEvidence',
    );
  }

  configureDetectionRule(
    _input:
      ConfigureDetectionRuleInput,
  ):
    Observable<
      DetectionRuleRecord
    > {

    return this.notFinalized(
      'configureDetectionRule',
    );
  }

  changeDetectionRuleStatus(
    _ruleId:
      string,

    _active:
      boolean,
  ):
    Observable<
      DetectionRuleRecord
    > {

    return this.notFinalized(
      'changeDetectionRuleStatus',
    );
  }

  private notFinalized<T>(
    operation:
      string,
  ):
    Observable<T> {

    const error:
      ApiError = {

      status:
        0,

      code:
        'RISK_DETECTION_HTTP_CONTRACT_NOT_FINALIZED',

      message:
        `Risk Detection HTTP operation "${operation}" cannot be enabled until the backend contract is finalized.`,

      fieldErrors:
        [],
    };

    return throwError(
      () =>
        error,
    );
  }
}