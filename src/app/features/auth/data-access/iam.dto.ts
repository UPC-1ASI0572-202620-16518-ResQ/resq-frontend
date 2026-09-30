export interface AuthenticationResultResourceDto {
  identityId: string;

  sessionToken: string;
}

export interface AssignRoleResourceDto {
  roleId: string;

  organizationId: string;
}

export interface RoleAssignmentResourceDto {
  assignmentId: string;

  identityId: string;

  roleId: string;

  organizationId: string;
}