import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

export interface AuthenticationInput {
  loginIdentifier: string;

  credentialSecret: string;
}

export interface AuthenticationSessionRecord {
  identityId: string;

  sessionToken: string;
}

export interface AssignRoleInput {
  roleId: string;

  organizationId: string;
}

export interface RoleAssignmentRecord {
  assignmentId: string;

  identityId: string;

  roleId: string;

  organizationId: string;
}

export interface IamGateway {

  authenticate(
    input:
      AuthenticationInput,
  ):
    Observable<
      AuthenticationSessionRecord
    >;

  assignRole(
    identityId: string,

    input:
      AssignRoleInput,
  ):
    Observable<
      RoleAssignmentRecord
    >;
}

export const IAM_GATEWAY =
  new InjectionToken<IamGateway>(
    'IAM_GATEWAY',
  );