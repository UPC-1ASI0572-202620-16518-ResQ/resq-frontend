import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionFacade } from './auth-session.facade';

export const authGuard: CanActivateFn = () => {
  const session = inject(AuthSessionFacade);
  const router = inject(Router);
  return session.authenticated() ? true : router.createUrlTree(['/login']);
};
