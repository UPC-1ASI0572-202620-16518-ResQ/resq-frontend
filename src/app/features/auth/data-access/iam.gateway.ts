import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

export interface AuthenticationInput {
  username: string;
  password: string;
}

export interface AuthenticationSessionRecord {
  userId: number;
  username: string;
  token: string;
  role: string;
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
