import { Injectable, computed, inject } from '@angular/core';
import { ApiError } from '../../core/api/api-error';
import { IamFacade } from './data-access/iam.facade';
import { UserFacade } from '../users/data-access/user.facade';

export type ResqRole = 'CITIZEN' | 'VOLUNTEER';

export interface SessionPrincipal {
  identityId?: string;
  userId?: string;
  role: ResqRole;
}

/** UI authorization projection derived from the role returned by IAM. */
@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly iam = inject(IamFacade);
  private readonly users = inject(UserFacade);

  readonly principal = computed<SessionPrincipal>(() => {
    const identityId = this.iam.identityId();
    const userId = this.users.profile()?.userId;
    return {
      identityId,
      userId,
      role: normalizeRole(this.iam.role()),
    };
  });

  /** The current API protects these endpoints with authentication only; IAM exposes no admin role. */
  readonly isAdministrator = computed(() => false);
  readonly canManageIncidents = computed(() => Boolean(this.principal().identityId));
  readonly canAuthorizeCriticalResponses = computed(() => Boolean(this.principal().identityId));
  readonly roleLabel = computed(() =>
    this.principal().role === 'VOLUNTEER' ? 'Volunteer' : 'Citizen',
  );

  requireAuthenticated(): SessionPrincipal {
    const principal = this.principal();
    if (!principal.identityId || !principal.userId) {
      throw authorizationError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }
    return principal;
  }

  requireIncidentManager(): SessionPrincipal {
    const principal = this.requireAuthenticated();
    if (!this.canManageIncidents()) {
      throw authorizationError(
        403,
        'INCIDENT_MANAGEMENT_FORBIDDEN',
        'An authenticated session is required to manage incidents.',
      );
    }
    return principal;
  }

  requireCriticalResponseAuthorizer(): SessionPrincipal {
    const principal = this.requireAuthenticated();
    if (!this.canAuthorizeCriticalResponses()) {
      throw authorizationError(
        403,
        'CRITICAL_RESPONSE_FORBIDDEN',
        'An authenticated session is required to authorize critical responses.',
      );
    }
    return principal;
  }
}

function normalizeRole(role?: string): ResqRole {
  return role?.trim().toUpperCase() === 'VOLUNTEER' ? 'VOLUNTEER' : 'CITIZEN';
}

function authorizationError(status: number, code: string, message: string): ApiError {
  return { status, code, message, fieldErrors: [] };
}
