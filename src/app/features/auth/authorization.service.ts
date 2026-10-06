import { Injectable, computed, inject } from '@angular/core';
import { ApiError } from '../../core/api/api-error';
import { IamFacade } from './data-access/iam.facade';
import { UserFacade } from '../users/data-access/user.facade';

export type ResqRole = 'ADMINISTRATOR' | 'VIEWER';

export interface SessionPrincipal {
  identityId?: string;
  userId?: string;
  role: ResqRole;
}

/**
 * Frontend mock authorization projection.
 *
 * UI checks improve usability, while mock gateways repeat authorization checks
 * as the trusted boundary. The production backend must derive roles from the
 * authenticated request and enforce every command server-side.
 */
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
      role: identityId
        ? identityId === 'identity-user-1'
          ? 'ADMINISTRATOR'
          : 'VIEWER'
        : userId === 'user-1'
          ? 'ADMINISTRATOR'
          : 'VIEWER',
    };
  });

  readonly isAdministrator = computed(() => this.principal().role === 'ADMINISTRATOR');
  readonly canManageIncidents = this.isAdministrator;
  readonly canAuthorizeCriticalResponses = this.isAdministrator;
  readonly roleLabel = computed(() =>
    this.isAdministrator() ? 'Administrator' : 'Viewer',
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
        'Administrator permission is required to manage incidents.',
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
        'Administrator permission is required to authorize critical responses.',
      );
    }
    return principal;
  }
}

function authorizationError(status: number, code: string, message: string): ApiError {
  return { status, code, message, fieldErrors: [] };
}
