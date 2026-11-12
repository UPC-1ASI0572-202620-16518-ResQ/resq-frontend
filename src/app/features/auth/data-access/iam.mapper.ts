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
    userId: dto.id,
    username: dto.username,
    token: dto.token,
    role: dto.role,
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
