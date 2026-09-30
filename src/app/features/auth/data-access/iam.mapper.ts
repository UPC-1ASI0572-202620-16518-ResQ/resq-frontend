import {
  AuthenticationResultResourceDto,
  RoleAssignmentResourceDto,
} from './iam.dto';

import {
  AuthenticationSessionRecord,
  RoleAssignmentRecord,
} from './iam.gateway';

export function mapAuthenticationResultResourceDto(
  dto:
    AuthenticationResultResourceDto,
):
  AuthenticationSessionRecord {

  return {
    identityId:
      dto.identityId,

    sessionToken:
      dto.sessionToken,
  };
}

export function mapRoleAssignmentResourceDto(
  dto:
    RoleAssignmentResourceDto,
):
  RoleAssignmentRecord {

  return {
    assignmentId:
      dto.assignmentId,

    identityId:
      dto.identityId,

    roleId:
      dto.roleId,

    organizationId:
      dto.organizationId,
  };
}   