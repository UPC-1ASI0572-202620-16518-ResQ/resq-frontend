export interface AuthenticationResultResourceDto {
  id: number;
  username: string;
  token: string;
  role: string;
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
