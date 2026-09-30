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
  AlertQueryFilters,
  AlertRecord,
  AlertResponseGateway,
  AuthorizationDecision,
  ConfigureResponsePolicyInput,
  ResponseExecutionQueryFilters,
  ResponseExecutionRecord,
  ResponsePolicyRecord,
  UpdateResponsePolicyInput,
} from './alert.gateway';

/**
 * HTTP adapter placeholder for Alert & Response Management.
 *
 * IMPORTANT:
 *
 * The current Project Report describes the REST resources
 * for AlertController, ResponseExecutionController and
 * ResponsePolicyController as conceptual examples.
 *
 * Unlike Device Management and Building Management, the
 * final request/response resources are not specified with
 * enough precision to safely activate this adapter yet.
 *
 * When backend publishes its final OpenAPI/Swagger contract:
 *
 * 1. confirm endpoint paths;
 * 2. confirm JSON resource shapes;
 * 3. complete the mappings in alert.dto.ts / alert.mapper.ts;
 * 4. replace each placeholder below with HttpClient calls;
 * 5. only then enable this adapter through the provider.
 */
@Injectable()
export class HttpAlertGateway
  implements AlertResponseGateway {

  getAlerts(
    _filters:
      AlertQueryFilters,
  ):
    Observable<
      AlertRecord[]
    > {

    return this.notFinalized(
      'getAlerts',
    );
  }

  getAlertById(
    _alertId: string,
  ):
    Observable<
      AlertRecord
      | undefined
    > {

    return this.notFinalized(
      'getAlertById',
    );
  }

  getResponseExecutions(
    _filters:
      ResponseExecutionQueryFilters,
  ):
    Observable<
      ResponseExecutionRecord[]
    > {

    return this.notFinalized(
      'getResponseExecutions',
    );
  }

  getResponseExecutionById(
    _responseExecutionId:
      string,
  ):
    Observable<
      ResponseExecutionRecord
      | undefined
    > {

    return this.notFinalized(
      'getResponseExecutionById',
    );
  }

  decideResponseAuthorization(
    _responseExecutionId:
      string,

    _decision:
      AuthorizationDecision,
  ):
    Observable<
      ResponseExecutionRecord
    > {

    return this.notFinalized(
      'decideResponseAuthorization',
    );
  }

  getResponsePolicy(
    _policyId:
      string,
  ):
    Observable<
      ResponsePolicyRecord
      | undefined
    > {

    return this.notFinalized(
      'getResponsePolicy',
    );
  }

  configureResponsePolicy(
    _input:
      ConfigureResponsePolicyInput,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    return this.notFinalized(
      'configureResponsePolicy',
    );
  }

  updateResponsePolicy(
    _policyId:
      string,

    _input:
      UpdateResponsePolicyInput,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    return this.notFinalized(
      'updateResponsePolicy',
    );
  }

  changeResponsePolicyStatus(
    _policyId:
      string,

    _active:
      boolean,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    return this.notFinalized(
      'changeResponsePolicyStatus',
    );
  }

  private notFinalized<T>(
    operation: string,
  ):
    Observable<T> {

    const error:
      ApiError = {

      status:
        0,

      code:
        'ALERT_RESPONSE_HTTP_CONTRACT_NOT_FINALIZED',

      message:
        `Alert & Response HTTP operation "${operation}" cannot be enabled until the backend contract is finalized.`,

      fieldErrors:
        [],
    };

    return throwError(
      () =>
        error,
    );
  }
}