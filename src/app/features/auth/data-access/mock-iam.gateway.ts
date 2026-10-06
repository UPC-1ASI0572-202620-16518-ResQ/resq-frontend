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

import {
  AssignRoleInput,
  AuthenticationInput,
  AuthenticationSessionRecord,
  IamGateway,
  RoleAssignmentRecord,
} from './iam.gateway';

interface MockIdentity {
  identityId: string;

  userId: string;

  loginIdentifier: string;

  credentialSecret: string;

  status:
    'ACTIVE'
    | 'DISABLED';
}

@Injectable()
export class MockIamGateway
  implements IamGateway {

  /*
   * Mock-only authentication data.
   *
   * The raw credential exists here solely because
   * this is an in-memory development adapter.
   *
   * The real IAM backend must persist only the
   * protected CredentialHash representation.
   */
  private readonly identities:
    readonly MockIdentity[] = [

    {
      identityId:
        'identity-user-1',

      userId:
        'user-1',

      loginIdentifier:
        'admin@resq.io',

      credentialSecret:
        'password123',

      status:
        'ACTIVE',
    },

    {
      identityId:
        'identity-viewer-1',

      /*
       * The current User mock exposes one profile. Authorization is derived
       * from this identity first so Viewer behavior remains independently
       * testable until IAM/User backend contracts provide role claims.
       */
      userId:
        'user-1',

      loginIdentifier:
        'viewer@resq.io',

      credentialSecret:
        'password123',

      status:
        'ACTIVE',
    },
  ];

  private readonly assignments =
    signal<
      RoleAssignmentRecord[]
    >(
      [],
    );

  authenticate(
    input:
      AuthenticationInput,
  ):
    Observable<
      AuthenticationSessionRecord
    > {

    const loginIdentifier =
      input
        .loginIdentifier
        .trim()
        .toLowerCase();

    const identity =
      this.identities.find(
        item =>
          item
            .loginIdentifier
            .toLowerCase() ===
          loginIdentifier,
      );

    /*
     * We intentionally return the same response
     * for unknown identity and invalid credential.
     *
     * The IAM report explicitly avoids revealing
     * which part of authentication failed.
     */
    if (
      !identity ||
      identity.status !==
        'ACTIVE' ||
      identity
        .credentialSecret !==
        input.credentialSecret
    ) {

      return throwError(
        () =>
          authenticationFailed(),
      );
    }

    return of({
      identityId:
        identity.identityId,

      /*
       * Mock-only opaque session representation.
       *
       * The real token/session format belongs to
       * backend infrastructure and must not be
       * inferred by the frontend.
       */
      sessionToken:
        `mock-session-${identity.identityId}`,
    }).pipe(
      delay(100),
    );
  }

  assignRole(
    identityId: string,

    input:
      AssignRoleInput,
  ):
    Observable<
      RoleAssignmentRecord
    > {

    const identity =
      this.identities.find(
        item =>
          item.identityId ===
          identityId,
      );

    if (!identity) {

      return throwError(
        () =>
          notFound(
            'IDENTITY_NOT_FOUND',

            'The requested identity was not found.',
          ),
      );
    }

    if (
      identity.status !==
      'ACTIVE'
    ) {

      return throwError(
        () =>
          conflict(
            'IDENTITY_DISABLED',

            'A disabled identity cannot receive role assignments.',
          ),
      );
    }

    const roleId =
      input.roleId.trim();

    const organizationId =
      input
        .organizationId
        .trim();

    if (!roleId) {

      return throwError(
        () =>
          badRequest(
            'ROLE_REQUIRED',

            'A role is required.',
          ),
      );
    }

    if (!organizationId) {

      return throwError(
        () =>
          badRequest(
            'ORGANIZATION_REQUIRED',

            'An organization is required.',
          ),
      );
    }

    const duplicate =
      this.assignments().some(
        assignment =>
          assignment.identityId ===
            identityId &&

          assignment.roleId ===
            roleId &&

          assignment.organizationId ===
            organizationId,
      );

    if (duplicate) {

      return throwError(
        () =>
          conflict(
            'ROLE_ASSIGNMENT_ALREADY_EXISTS',

            'The identity already has this role in the selected organization.',
          ),
      );
    }

    /*
     * The current report does not define a REST
     * role catalog that the Web App can query.
     *
     * Therefore this mock validates the structure
     * and duplicate-assignment invariant, but does
     * NOT fabricate a role catalog.
     *
     * Role existence remains backend-authoritative.
     */
    const assignment:
      RoleAssignmentRecord = {

      assignmentId:
        createLocalId(
          'role-assignment',
        ),

      identityId,

      roleId,

      organizationId,
    };

    this.assignments.update(
      items => [
        ...items,
        assignment,
      ],
    );

    return of({
      ...assignment,
    }).pipe(
      delay(90),
    );
  }
}

function createLocalId(
  prefix:
    string,
): string {

  return (
    globalThis.crypto
      ?.randomUUID?.()
    ??
    `${prefix}-${Date.now()}`
  );
}

function apiError(
  status:
    number,

  code:
    string,

  message:
    string,
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
  code:
    string,

  message:
    string,
):
  ApiError {

  return apiError(
    400,
    code,
    message,
  );
}

function conflict(
  code:
    string,

  message:
    string,
):
  ApiError {

  return apiError(
    409,
    code,
    message,
  );
}

function notFound(
  code:
    string,

  message:
    string,
):
  ApiError {

  return apiError(
    404,
    code,
    message,
  );
}

function authenticationFailed():
  ApiError {

  return apiError(
    401,

    'AUTHENTICATION_FAILED',

    'The login identifier or credential is invalid.',
  );
}
