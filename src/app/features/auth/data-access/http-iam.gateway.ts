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
  AssignRoleInput,
  AuthenticationInput,
  AuthenticationSessionRecord,
  IamGateway,
  RoleAssignmentRecord,
} from './iam.gateway';

/**
 * HTTP adapter placeholder for IAM.
 *
 * The current project report describes resources
 * such as:
 *
 * POST /api/v1/auth/sessions
 *
 * POST
 * /api/v1/iam/identities/{identityId}/role-assignments
 *
 * as conceptual REST resources.
 *
 * Before activating this adapter the backend team
 * must confirm:
 *
 * - exact request payloads;
 * - exact response payloads;
 * - token/session mechanism;
 * - authentication header format;
 * - role-assignment response contract;
 * - organization context behavior.
 */
@Injectable()
export class HttpIamGateway
  implements IamGateway {

  authenticate(
    _input:
      AuthenticationInput,
  ):
    Observable<
      AuthenticationSessionRecord
    > {

    return this.notFinalized(
      'authenticate',
    );
  }

  assignRole(
    _identityId:
      string,

    _input:
      AssignRoleInput,
  ):
    Observable<
      RoleAssignmentRecord
    > {

    return this.notFinalized(
      'assignRole',
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
        'IAM_HTTP_CONTRACT_NOT_FINALIZED',

      message:
        `IAM HTTP operation "${operation}" cannot be enabled until the backend authentication and role-assignment contract is finalized.`,

      fieldErrors:
        [],
    };

    return throwError(
      () =>
        error,
    );
  }
}